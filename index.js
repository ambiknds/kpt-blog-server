const express = require('express');
const cors = require('cors');
const mongoose  = require('mongoose');
const User = require('./models/User');
const app = express();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const multer = require('multer')
const uploadMiddleware = multer({ dest: 'uploads/' });
const fs = require('fs')
const Post = require('./models/Post'); 
require('dotenv').config();

app.use(cors({credentials: true, origin: 'http://localhost:5173'}));
app.use(express.json());
app.use(cookieParser())
app.use('/uploads', express.static(__dirname + '/uploads'))

const salt = bcrypt.genSaltSync(10);
const secret = process.env.JWT_SECRET;

mongoose.connect(process.env.DB_URL || 'production');

app.get('/', (req,res)=> res.send("Hello There"))

app.post('/register' , async (req, res) => {
    const {username, email, password} = req.body;
    
    try{
        const userDoc =  await User.create({
            username, 
            email, 
            password: bcrypt.hashSync(password, salt)
        })
        res.json(userDoc)
        // res.json('Registration Successful')
    }
    catch(err){
        res.status(400).json(err);
    }
})

app.post('/login', async (req,res) => {
    const {email, password} = req.body;
    const userDoc = await User.findOne({email});
    const passOk = bcrypt.compareSync(password, userDoc.password);

    if(passOk) {
        jwt.sign({username: userDoc.username, id:userDoc._id}, secret, {} , (err, token) => {
            if(err) throw err;
            res.cookie('token', token).json({
                id: userDoc._id,
                username: userDoc.username,
            })
        }) 
    }
    else{
        res.status(400).json("Wrong Credential");
    }
})

app.get('/profile', (req,res) => {
    const {token} = req.cookies;
    jwt.verify(token, secret, {} , (err, info) => {
        if(err) throw err;
        res.json(info);
    })
})

app.post('/logout', (req,res) => {
    res.cookie('token', '').json('logout')
})

app.post('/create-post', uploadMiddleware.single('file'), async (req, res) => {
    const {originalname, path} = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path+'.'+ext;
    fs.renameSync(path, newPath); 

    const {token} = req.cookies;
    jwt.verify(token, secret, {} , async (err, info) => {
        if(err) throw err;
        const{title, summary, content} = req.body;
        try{
            const postDoc =  await Post.create({
                title, 
                summary,
                author: info.id, 
                cover: newPath,
                content,
                
            })
            res.json(postDoc);
        }
        catch(err){
            res.status(400).json(err);
        }
            res.json(info);
        })
    
    
})

app.get('/post' , async (req, res) => {
    const posts = await Post.find().populate('author', ['username']).sort({createdAt: -1}); //.limit can be added later
    res.json(posts);
})

app.get('/post/:id' , async (req, res) => {
    const {id} = req.params;
    const postDoc = await Post.findById(id).populate('author', ['username']);
    res.json(postDoc);
})

app.put('/update-post', uploadMiddleware.single('file'), async (req, res) => {
    let newPath = null;
    
    if(req.file){
        const {originalname, path} = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        newPath = path+'.'+ext;
        fs.renameSync(path, newPath); 
    }
    
    const {token} = req.cookies;
    jwt.verify(token, secret, {} , async (err, info) => {
        if(err) throw err;
        const{id, title, summary, content} = req.body;
        const postDoc =  await Post.findById(id);
      
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
        
        if(!isAuthor){
            return res.status(400).json("You are not the Author");
        }
        await postDoc.updateOne({
            title,
            summary,
            content,
            cover: newPath ? newPath : postDoc.cover,
        });
        res.json(postDoc);
    })
})


app.listen(4000);