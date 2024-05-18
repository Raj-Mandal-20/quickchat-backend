const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const io = require("../socket");

const Post = require("../models/post");
const User = require("../models/user");
const { validationResult } = require("express-validator");
exports.getPosts = (req, res, next) => {
  // console.log("GEtting Post");
  const currentPage = req.query.page || 1;
  const perPage = 3;
  let totalItems;
  Post.find()
    .countDocuments()
    .then((count) => {
      // console.log(count);
      totalItems = count;
      return Post.find()
        .skip((currentPage - 1) * perPage)
        .limit(perPage);
    })
    .then((posts) => {
      // console.log(posts);
      res.status(200).json({
        message: "Fetched posts Successfully.",
        posts: posts,
        totalItems: totalItems,
      });
    })
    .catch((err) => {
      // console.log(err);
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.addPost = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation Falid, Data enterred is Incorrect");
    error.statusCode = 422;
    throw error;
  }

  if (!req.file) {
    const error = new Error("No Image Provided");
    error.statusCode = 422;
    // console.log("file ERROR ☑");
    // console.log(er ror);
    throw error;
  }

  const title = req.body.title;
  const content = req.body.content;
  // const imageUrl = req.file.path;
  const imageUrl = req.file.path.replace("\\", "/");
  // const imageUrl = 'images/coffie.png';
  let creator;
  const post = new Post({
    title: title,
    content: content,
    imageUrl: imageUrl,
    creator: req.userId,
  });
  // console.log(post);
  post
    .save()
    .then((result) => {
      // console.log(result);
      return User.findById(req.userId);
    })
    .then((user) => {
      creator = user;
      user.posts.push(post);
      return user.save();
    })
    .then((result) => {
      // console.log("Data posted");  
      io.getIO().emit("posts", {
        action: "create",
        post : post
      });
      res.status(201).json({
        message: "Message Post Successfully!",
        post: post,
        creator: {
          _id: creator._id,
          name: creator.name,
        },
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.getPost = async (req, res, next) => {
  const postId = req.params.postId;

  const post = await Post.findById(postId);
  try {
    if (!post) {
      const error = new Error("Could not find Post.");
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({
      message: "Post Fetched Successfully",
      post: post,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
      console.log('you find it')
    }
    next(err);
  }
};

exports.updatePost = (req, res, next) => {
  const postId = req.params.postId;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation Falid, Data enterred is Incorrect");
    error.statusCode = 422;
    throw error;
  }
  const title = req.body.title;
  const content = req.body.content;
  let imageUrl = req.body.image;
  if (req.file) {
    imageUrl = req.file.path.replace("\\", "/");
  }
  if (!imageUrl) {
    const error = new Error("No file Picked!"
    
    );
    error.statusCode = 422;
    throw error;
  }
  // let intPost;
  Post.findById(postId)
    .then((post) => {
      if (!post) {
        const error = new Error("Could not find Post.");
        error.statusCode = 404;
        throw error;
      }

      if (post.creator.toString() !== req.userId) {
        const error = new Error("You are not Authorized to edit this post");
        error.statusCode = 401;
        throw error;
      }
      if (imageUrl !== post.imageUrl) clearImage(post.imageUrl);

      post.title = title;
      post.imageUrl = imageUrl;
      post.content = content;
      return post.save();
    })
    .then((posts)=>{
      io.getIO().emit('posts', {
        action : 'update'
      })
      res.status(200).json({
        message: "Post Updated Successfully!",
        post: posts,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

const clearImage = (filename) => {
  filename = path.join(__dirname, "..", filename);
  fs.unlink(filename, (err) => {
    if (err) {
      console.error('Error deleting file:', err);
      return;
    }
    console.log('File deleted successfully');
  });
};

exports.deletePost = (req, res, next) => {
  const postId = req.params.postId;

  // My solution to delete post
  // User.findById(req.userId)
  //   .then(cUser => {
  //     const ownPost = cUser.posts.find(id=> id.toString() === postId);
  //     if(ownPost === undefined){
  //          const error = new Error("It's not Your Post so Your Can't Edit or Delete It.");
  //          error.statusCode = 401;
  //          throw error;
  //     }
  //     console.log(ownPost)
  //     return Post.findById(postId);
  //   })
  //   .then(post => {
  //     clearImage(post.imageUrl);
  //     return Post.findByIdAndRemove(postId);
  //   })
  //   .then(result => {
  //     console.log(result);
  //     res.status(200).json({
  //       message : 'Post Deleted Successfully!'
  //     })
  //   })
  //   .catch((err) => {
  //     if (!err.statusCode) {
  //       err.statusCode = 500;
  //     }
  //     next(err);
  //  });

  Post.findById(postId)
    .then((post) => {
      if (!post) {
        const error = new Error("Can't Find The Post");
        error.statusCode = 404;
        throw error;
      }

      if (post.creator.toString() !== req.userId) {
        const error = new Error("You are not Authorized to delete this post");
        error.statusCode = 401;
        throw error;
      }
      clearImage(post.imageUrl);
      return Post.findByIdAndRemove(postId);
    })
    .then(() => {
      return User.findById(req.userId);
    })
    .then((user) => {
      user.posts.pull(postId);
      return user.save();
    })
    .then(() => {
      // console.log(result);
      return Post.find();
    
    })
    .then(post => {
      io.getIO().emit('posts', {
        action : 'delete',
        post : post
      });

      res.status(200).json({
        message: "Post Deleted Successfully!",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.showStatus = async (req, res, next) => {
  try {
    // console.log('Request Body '+ req.userId);

    const user = await User.find(new mongoose.Types.ObjectId(req.userId));

    // console.log(user);
    if (!user) {
      const error = new Error("User not defined");
      error.statusCode = 404;
      throw error;
    }

    // console.log('Currnt USER  ' + user);
    res.status(200).json({
      message: "Displaying Status!",
      status: user[0].status,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updateStatus = (req, res, next) => {
  const newStatus = req.body.status;

  User.findById(req.userId)
    .then((user) => {
      if (!user) {
        const error = new Error("User not defined");
        error.statusCode = 404;
        throw error;
      }
      user.status = newStatus;
      return user.save();
    })
    .then((result) => {
      // console.log(result);
      res.status(200).json({
        message: "Status Updated!",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};
