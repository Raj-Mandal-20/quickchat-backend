const User = require("../models/user");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");

exports.signup = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation Failed");
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }

  const email = req.body.email;
  const password = req.body.password;
  const name = req.body.name;
  bcrypt
    .hash(password, 12)
    .then((hashpw) => {
      const user = new User({
        email: email,
        password: hashpw,
        name: name,
      });
      return user.save();
    })
    .then((result) => {
      res.status(200).json({
        message: "User Created!",
        userId: result._id,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.login = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  let loadedUser;
  User.findOne({ email: email })
    .then((user) => {
      if (!user) {
        const error = new Error("No Account Found with this " + email);
        error.statusCode = 401;
        throw error;
      }
      loadedUser = user;
      return bcrypt.compare(password, user.password);
    })
    .then((isEqual) => {
      if (!isEqual) {
        const error = new Error("Wrong Password");
        error.statusCode = 401;
        throw error;
      }
      const token = jwt.sign(
        {
          email: loadedUser.email,
          userId: loadedUser._id.toString(),
        },
        "somesupersecret",
        { expiresIn: "1h" }
      );
      req.userId = loadedUser._id;
      res.status(200).json({
        token: token,
        userId: loadedUser._id.toString(),
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};
