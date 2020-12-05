const express = require('express');
const path = require('path');
const cors=require('cors');
const bcrypt=require('bcryptjs');

var mongodb=require("mongodb");
var MongoClient=mongodb.MongoClient;
var url=process.env.MongoDB_URL;
var fs=require('fs');
const app = express();
const PORT = process.env.PORT || 8080; // Step 1
var dbname="shoppingcart";
const nodemailer=require("nodemailer");
const jwt = require("jsonwebtoken");
const fileUpload=require('express-fileupload');
const client_URL=process.env.client_URL;
const client_URL_seller=process.env.client_URL_seller;
const forgot_client_URL=process.env.forgot_client_URL;
const forgot_client_URL_seller=process.env.forgot_client_URL_seller;
const multer=require('multer');
const helper=require('./helper');
const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;
require("dotenv").config();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(fileUpload());
app.use('/', express.static(path.join(__dirname, '/public')));
app.get("/", express.static(path.join(__dirname, "./public")));
const gmail_user=process.env.gmail_user;
const clientID=process.env.clientID;
const clientSecret=process.env.clientSecret;
const refreshToken=process.env.refreshToken;
const oauth2Client = new OAuth2(
    clientID,
    clientSecret,
    "https://developers.google.com/oauthplayground" // Redirect URL
  );
  
  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });
  const accessToken = oauth2Client.getAccessToken()
  
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: "OAuth2",
      user: gmail_user,
      clientId: clientID,
      clientSecret: clientSecret,
      refreshToken: refreshToken,
      accessToken: accessToken
    }
  });
  var authenticate = function(req, res, next) {
    if (req.body.token) {
        jwt.verify(req.body.token, process.env.JWT_SECRET, function(err, decoded) {
            if (decoded) {
                next();
            } else {
                res.json({
                    message: "Token is not valid"
                })
            }
        });
        //next();
    } else {
        res.json({
            message: "Not Authenticated"
        });
    }
};

app.post('/upload',(req,res)=>{
    if(req.files===null)
    {
        return res.status(400).json({msg:'No file is Uploaded'});
    }
    console.log(req);
    console.log(req.files);
    const file=req.files.file;
    console.log(file);
    file.mv(`${__dirname}/public/uploads/${file.name}`,err=>{
        if(err)
        {
            console.error(err);
            return res.status(500).send(err);
        }
        res.json({fileName:file.name})
    });
});

app.post("/addtoCart",authenticate,(req,res)=>{
    MongoClient.connect(url,async function(err,client){
        if(err)
            console.log("Error while connecting to MongoDB Atlas",err);
        var db=client.db(dbname);
        console.log(req.body.index);
        var productData=await db.collection("productdetails").find({index:Number(req.body.index)}).toArray();
        console.log(productData);
        var updateProductDetails=await db.collection("productdetails").findOneAndUpdate({index:Number(req.body.index)},{$set:{quantity:productData[0].quantity-1}})
        var findData=await db.collection("addToCart").find({useremail:req.body.useremail,productname:req.body.productname}).toArray();
        if(findData.length>0)
        {
            
            db.collection("addToCart").findOneAndUpdate({useremail:req.body.useremail,productname:req.body.productname},{$set:{productquantity:findData[0].productquantity+1,productprice:Number(findData[0].productprice)+Number(req.body.productprice),index:findData[0].index}},
                function(err,data)
                {
                    if(err)
                    {
                        client.close();
                        console.log("Error while inserting into database");
                        res.json({message:err});
                    }
                    else
                    {
                        client.close();
                        res.json({message:"Data Updated Successfully"});
                    }
                })
        }
        else
        {
            var  getData=await db.collection("addToCart").find({}).toArray();
            req.body.index=getData.length+1;
           var cursor=db.collection("addToCart").insertOne(req.body);
           cursor.then(function(err,data)
           {
               
                   client.close();
                   res.json({message:"Product SuccessFully Added to Cart"});
               
           })
        }
    })
})
app.put("/changePasswordofUser",(req,res)=>{
    MongoClient.connect(url,async function(err,client){
        if(err)
            console.log("Error while connecting to MongoDB Atlas",err);
        var db=client.db(dbname);
        let salt=await bcrypt.genSalt(10);
        let hash=await bcrypt.hash(req.body.newpassword,salt);
        req.body.newpassword=hash;
        let updateData=db.collection("userdata").findOneAndUpdate({email:req.body.useremail},{$set:{password:req.body.newpassword}},
            function(err,data){
                if(err)
                {
                    client.close();
                    res.json({message:err})
                }
                else
                {
                    client.close();
                    res.json({message:"Data Updated Successfully"})
                }
            })
    })
})
app.post("/forgotPasswordUser",async function(req,res){
    let token = jwt.sign({ email: req.body.email }, process.env.EMAIL_SECRET);
    let mail_to_send=req.body.email;
    let url=`http://localhost:8080/changePasswordConfirm/${token}`;
    let info=await transporter.sendMail({
        from:gmail_user,
        to:mail_to_send,
        subject:"Online Shopping Mart--Forgot Password",
        html:`<a href=${url}>Please Click this link to change the password</a>`
    })
    res.json({message:"Email sent to Your Account. Kindly, Verify"});
                        
})
app.post("/forgotPasswordSeller",async function(req,res){
    let token = jwt.sign({ email: req.body.email }, process.env.EMAIL_SECRET);
    let mail_to_send=req.body.email;
    let url=`http://localhost:8080/changePasswordConfirmSeller/${token}`;
    let info=await transporter.sendMail({
        from:gmail_user,
        to:mail_to_send,
        subject:"Online Shopping Mart--Forgot Password",
        html:`<a href=${url}>Please Click this link to change the password</a>`
    })
    res.json({message:"Email sent to Your Account. Kindly, Verify"});
                        
})
app.get("/changePasswordConfirmSeller/:token",(req,res)=>{
    let email_verify=jwt.verify(req.params.token,process.env.EMAIL_SECRET,async function(err,decoded)
        {
            if(decoded)
            {
                res.redirect(forgot_client_URL_seller);    
            }
            else
            {
                res.json({
                    message:"Token is not valid"
                })
            }
        })
})
app.get("/changePasswordConfirm/:token",(req,res)=>{
    let email_verify=jwt.verify(req.params.token,process.env.EMAIL_SECRET,async function(err,decoded)
        {
            if(decoded)
            {
                res.redirect(forgot_client_URL);    
            }
            else
            {
                res.json({
                    message:"Token is not valid"
                })
            }
        })
})
app.put("/changePasswordofSeller",(req,res)=>{
    MongoClient.connect(url,async function(err,client){
        if(err)
            console.log("Error while connecting to MongoDB Atlas",err);
        var db=client.db(dbname);
        let salt=await bcrypt.genSalt(10);
        let hash=await bcrypt.hash(req.body.newpassword,salt);
        req.body.newpassword=hash;
        let updateData=db.collection("sellerdata").findOneAndUpdate({email:req.body.selleremail},{$set:{password:req.body.newpassword}},
            function(err,data){
                if(err)
                {
                    client.close();
                    res.json({message:err})
                }
                else
                {
                    client.close();
                    res.json({message:"Data Updated Successfully"})
                }
            })
    })
})
app.post("/uploadProducts",authenticate,(req,res)=>{
    MongoClient.connect(url,async function (err,client){
        if(err)
            console.log("Error while connecting to MongoDB Atlas",err);
        var db=client.db(dbname);
        var findData=await db.collection("productdetails").find({}).toArray();
        let index=findData.length+1;
        req.body.index=index;
        req.body.quantity=Number(req.body.quantity);
        var cursor=db.collection("productdetails").insertOne(req.body);
        cursor.then((err,data)=>{
            if(err)
            {
                client.close();
                res.json({message:err});
            }
            else
            {
                console.log("Product Details")
                client.close();
                res.json({message:"SuccessFully Inserted"})
            }
        })
    })
})  
app.post("/getCartDetails",authenticate,(req,res)=>{
    MongoClient.connect(url,async function(err,client)
    {
        try
        {
        if(err)
        {
            console.log("Error while connecting to MongoDB Atlas",err);
        }
        var db=client.db(dbname);
        var cartData=await db.collection("addToCart").find({useremail:req.body.useremail}).toArray();
        console.log(cartData);
        client.close();
        res.json({message:cartData});
        }
        catch(error)
        {
            client.close();
            console.log(error);
        }
    })
})

app.post("/adminLogin",(req,res)=>{
    MongoClient.connect(url,function(err,client){
    if(err)
        console.log("Error while connecting to MongoDB Atlas",err);
    var db=client.db(dbname);
    var cursor=db.collection("admindata").findOne({name:req.body.name})
    cursor.then(async function(user)
    {
        console.log(cursor);
        if(user)
        {
            let token=jwt.sign({email:req.body.name},process.env.JWT_SECRET);
            let result=await bcrypt.compare(req.body.password,user.password);
            if(result)
            {
                client.close();
                res.json({
                    message:"Success",
                    token})
            }
            else
            {
                client.close();
                res.json({
                    message:"Username or Password is incorrect"
                })
            }

        }
        else
        {
            res.json({message:"User not found"})
        }
        })
    })
})
app.post("/",(req,res)=>{
    MongoClient.connect(url,function(err,client)
    {
        if(err)
            console.log("Error connecting to Mongo DB Atlas",err);
        var db=client.db(dbname);
        var findData=db.collection("userdata").findOne({email:req.body.email})
            findData.then(async function(data)
            {
                if(data)
                {
                    client.close();
                    res.json({message:"Email Address Already Exists. Provide new Email Address"});
                }
                else
                {
                    try
                    {
                        let token = jwt.sign({ email: req.body.email }, process.env.EMAIL_SECRET);
                        let mail_to_send=req.body.email;
                        let url=`http://localhost:8080/insertUserDataConfirm/${token}`;
                        let info=await transporter.sendMail({
                            from:gmail_user,
                            to:mail_to_send,
                            subject:"Online Shopping Mart--Regsiter user",
                            html:`<a href=${url}>Please Click this link to activate the account`
                        })
                        req.body.email_verify=false;
                        let salt=await bcrypt.genSalt(10);
                        let hash=await bcrypt.hash(req.body.password,salt);
                        req.body.password=hash;
                        var cursor=db.collection("userdata").insertOne(req.body);
                        cursor.then(function(err,data){
                            if(err)
                                console.log("Error while inserting data in to the database")
                            client.close();
                            res.json({message:"Email Sent to your email account. Please Verify"})
                        })
                        
                    }
                    catch(error)
                    {
                        if(client)
                            client.close();
                        res.json({
                            message:error
                        });
                    }

                }
            })
    })
})  
app.get("/insertUserDataConfirm/:token",(req,res)=>{
    MongoClient.connect(url,async function(err,client)
    {
        if(err)
            console.log("Error in connecting to Mongo DB Atlas",err);
        var db=client.db(dbname);
        let email_verify=jwt.verify(req.params.token,process.env.EMAIL_SECRET,async function(err,decoded)
        {
            if(decoded)
            {
                        
                        db.collection("userdata").findOneAndUpdate({email:decoded.email},{$set:{email_verify:true}},
                        function(err,data)
                        {
                            if(err)
                            {
                                console.log("Error while inserting into database");
                            }
                            client.close();
                            res.redirect(client_URL);
                        })
                    
            }
            else
            {
                client.close();
                res.json({
                    message:"Token is not valid"
                })
            }
        })
        
    })
});
app.post("/userlogin",(req,res)=>{
    MongoClient.connect(url,function(err,client)
    {
        if(err)
            console.log("Error while connecting to MongoDB Atlas",err);
        var db=client.db(dbname);
        var loginData=db.collection("userdata").findOne({email:req.body.email});
        loginData.then(async function(user)
        {
            if(user)
            {
                let email_verify=user.email_verify;

                if(email_verify)
                {
                    try
                    {
                        let token=jwt.sign({email:req.body.email},process.env.JWT_SECRET)
                        let result=await bcrypt.compare(req.body.password,user.password)
                        if(result)
                        {
                            client.close();
                            res.json({
                                message:"Success",
                                token
                            })
                        }
                        else
                        {
                            client.close();
                            res.json({message:"User Name or Password is incorrect"});
                        }
                    }
                    catch(error)
                    {
                        client.close();
                        res.json({message:error})
                    }
                }
                else
                {
                    client.close();
                    res.json({message:"Email is not verified,Kindly verify your email to login"})
                }

            }
            else
            {
                client.close();
                res.json({message:"Provided Email is not registered"});
            }
        })
    })
})

app.post("/insertSellerData",(req,res)=>{
    MongoClient.connect(url,function(err,client)
    {
        if(err)
            console.log("Error connecting to Mongo DB Atlas",err);
        var db=client.db(dbname);
        var findData=db.collection("sellerdata").findOne({email:req.body.email})
            findData.then(async function(data)
            {
                if(data)
                {
                    client.close();
                    res.json({message:"Email Address Already Exists. Provide new Email Address"});
                }
                else
                {
                    try
                    {
                        let token = jwt.sign({ email: req.body.email }, process.env.EMAIL_SECRET);
                        let mail_to_send=req.body.email;
                        let url=`http://localhost:8080/insertSellerDataConfirm/${token}`;
                        let info=await transporter.sendMail({
                            from:gmail_user,
                            to:mail_to_send,
                            subject:"Online Shopping Mart--Register Seller",
                            html:`<a href=${url}>Please Click this link to activate the account`
                        })
                        req.body.email_verify=false;
                        let salt=await bcrypt.genSalt(10);
                        let hash=await bcrypt.hash(req.body.password,salt);
                        req.body.password=hash;
                        var findData=await db.collection("sellerdata").find({}).toArray();
                        req.body.index=findData.length+1;
                        var cursor=db.collection("sellerdata").insertOne(req.body);
                        cursor.then(function(err,data){
                            if(err)
                                console.log("Error while inserting data in to the database")
                            client.close();
                            res.json({message:"Email Sent to your email account. Please Verify"})
                        })
                        
                    }
                    catch(error)
                    {
                        if(client)
                            client.close();
                        res.json({
                            message:error
                        });
                    }

                }
            })
    })
});
app.get("/insertSellerDataConfirm/:token",(req,res)=>{
    MongoClient.connect(url,async function(err,client)
    {
        if(err)
            console.log("Error in connecting to Mongo DB Atlas",err);
        var db=client.db(dbname);
        let email_verify=jwt.verify(req.params.token,process.env.EMAIL_SECRET,async function(err,decoded)
        {
            if(decoded)
            {
                        
                        db.collection("sellerdata").findOneAndUpdate({email:decoded.email},{$set:{email_verify:true}},
                        function(err,data)
                        {
                            if(err)
                            {
                                console.log("Error while inserting into database");
                            }
                            client.close();
                            res.redirect(client_URL_seller);
                        })
                    
            }
            else
            {
                client.close();
                res.json({
                    message:"Token is not valid"
                })
            }
        })
        
    })
});
app.post("/sellerlogin",(req,res)=>{
    MongoClient.connect(url,function(err,client)
    {
        if(err)
            console.log("Error while connecting to MongoDB Atlas",err);
        var db=client.db(dbname);
        var loginData=db.collection("sellerdata").findOne({email:req.body.email});
        loginData.then(async function(user)
        {
            if(user)
            {
                let email_verify=user.email_verify;
                let admin_verify=user.admin_verify;
                if(admin_verify=="approved" && email_verify)
                {
                    try
                    {
                        let token=jwt.sign({email:req.body.email},process.env.JWT_SECRET)
                        let result=await bcrypt.compare(req.body.password,user.password)
                        if(result)
                        {
                            client.close();
                            res.json({
                                message:"Success",
                                token
                            })
                        }
                        else
                        {
                            client.close();
                            res.json({message:"User Name or Password is incorrect"});
                        }
                    }
                    catch(error)
                    {
                        client.close();
                        res.json({message:error})
                    }
                }
                else if(email_verify && admin_verify=="pending")
                {
                    client.close();
                    res.json({message:"Admin is not verified your account"})
                }
                else if(admin_verify==="rejected" && email_verify)
                {
                    client.close();
                    res.json({message:"Admin rejected your registration"})
                }
                else
                {
                    client.close();
                    res.json({message:"Email is not verified,Kindly verify your email to login"})
                }

            }
            else
            {
                client.close();
                res.json({message:"Provided Email is not registered"});
            }
        })
    })
});
app.post("/files",(req,res)=>{
    MongoClient.connect(url,function(err,client)
    {
        if(err)
            console.log("Error while connecting to MongoDB Atlas",err);
        console.log(req.body,req.file)
        res.json({message:req.body})
    })
});
app.post("/sellerDetails",authenticate,(req,res)=>{
    MongoClient.connect(url,function(err,client)
    {
        if(err)
            console.log("Error while connecting to the MongoDB Atlas",err)
        var db=client.db(dbname); 
        var cursor=db.collection("sellerdata").find({admin_verify:req.body.status.toString()}).toArray();
        cursor.then(function(err,data)
        {
            if(err)
            {
                client.close();
                res.json({message:err});
            }
            else
            {
                client.close();
                res.json({message:data})
            }
        })

    })
});
app.get("/getSellerDataById/:id",(req,res)=>{
    MongoClient.connect(url,function(err,client)
    {
        if(err)
            console.log("Error while connecting to the MongoDB Atlas",err)
        var db=client.db(dbname);
        var cursor=db.collection("sellerdata").findOne({index:Number(req.params.id)});
        cursor.then(function(user)
        {
            if(user)
            {
                client.close();
                res.json({message:user})
            }
            else
            {
                client.close();
                res.json({message:""});
            }
        })
    })
})
app.put("/changeSellerStatusById",authenticate,(req,res)=>{
    MongoClient.connect(url,async function(err,client)
    {
        if(err)
            console.log("Error while connecting to MongoDB Atlas",err)
        var db=client.db(dbname);
       
        db.collection("sellerdata").findOneAndUpdate({index:Number(req.body.id)},{$set:{"admin_verify":req.body.status}},
        async function(err,data)
        {
            if(err)
                console.log("Error while updating the data in the database",err)
            else
            {
                if(req.body.status=="rejected")
                {
                    let info=await transporter.sendMail({
                        from:gmail_user,
                        to:data.value.email,
                        subject:"Online Shopping Mart--Seller Registration Cancelled",
                        html:`<h4>Your registration is Cancelled By Admin</h4>`
                    })
                }
                client.close();
                res.json({message:"Updated Successfully"})
            }
        });
    })
});
app.post("/addItemstoShoppingList",(req,res)=>{
    MongoClient.connect(url,function(err,client)
    {
        if(err)
            console.log("Error while connecting to the MongoDB Atlas",err);
        var db=client.db(dbname);
        
        var cursor=db.collection("itemsdata").insertOne(req.body);
        cursor.then(function(err,data)
        {
            if(err)
            {
                console.log("Error while inserting data in to the database");
                client.close();
                res.json({message:"Item is not added to the shopping list"})
            }
            else
            {
                client.close();
                res.json({message:"Item added to the list"})
            }
            
        })
    })
})
app.post("/productdetails",authenticate,(req,res)=>{
    MongoClient.connect(url,function(err,client){
        if(err)
        {
            console.log("Error while connectiong to MongoDB Atlas",err);
        }
        var db=client.db(dbname);
        var cursor=db.collection("productdetails").find({}).toArray();
        cursor.then(function(err,data)
        {
            if(err)
            {
                client.close();
                res.json({
                    message:err
                })
            }
            else
            {
                client.close();
                res.json({
                    message:data
                })
            }            
        })
    })
})
app.get("/:imagename", (req, res) => {
    let imagename=req.params.imagename.toString().slice(1);
    res.sendFile(path.join(__dirname, `./public/uploads/${imagename}`));
});
app.get("/getCartDetailsById/:id",(req,res)=>{
    MongoClient.connect(url,function(err,client)
    {
        if(err)
        {
            console.log("Error while connectiong to MongoDB Atlas",err)
        }
        var db=client.db(dbname);
        var findData=db.collection("addToCart").find({index:Number(req.params.id)}).toArray();
        findData.then(function(err,data){
            if(err)
            {
                client.close();
                res.json({message:err});
            }
            else
            {
                client.close();
                res.json({message:data})
            }
        })   
    })
})
app.post("/getProductDetailsBySellerEmail",authenticate,(req,res)=>{
    MongoClient.connect(url,function(err,client)
    {
        if(err)
        {
            console.log("Error while connecting to MongoDB Atlas",err);
        }
        var db=client.db(dbname);
        var findData=db.collection("productdetails").find({selleremail:req.body.selleremail}).toArray();
        findData.then(function(err,data){
            if(err)
            {
                client.close();
                res.json({message:err});
            }
            else{
                client.close();
                res.json({message:data})
            }
        })
    })
});
app.get("/getProductDetailsById/:id",(req,res)=>{
    MongoClient.connect(url,function(err,client)
    {
        if(err)
        {
            console.log("Error while connecting to the MongoDB Atlas",err)
        }
        var db=client.db(dbname);
        var getData=db.collection("productdetails").find({index:Number(req.params.id)}).toArray();
        getData.then(function(err,data)
        {
            if(err)
            {
                client.close();
                res.json({message:err})
            }
            else
            {
                client.close();
                res.json({message:data})
            }
        })
    })
})
app.put("/updateProductDetails",authenticate,(req,res)=>{
    MongoClient.connect(url,function(err,client)
    {
        if(err)
        {
            console.log("Error while connecting to Mongo DB Atlas",err)
        }
        var db=client.db(dbname);
        console.log(req.body)
        var updateData=db.collection("productdetails").findOneAndUpdate({index:req.body.index,selleremail:req.body.selleremail},{$set:{productname:req.body.productname,productprice:req.body.productprice,productbrandname:req.body.productbrandname,quantity:req.body.quantity,imagename:req.body.imagename}},
        function(err,data)
        {
            if(err)
            {
                client.close();
                res.json({message:err})
            }
            else
            {
                client.close();
                res.json({message:"Data SuccessFully Updated"})
            }

        })
    })
})
app.listen(PORT, console.log(`Server is starting at ${PORT}`));
