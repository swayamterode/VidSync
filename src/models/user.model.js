import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true, // removes extra whitespace from the back and front
      lowercase: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true, // removes extra whitespace from the back and front
      lowercase: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true, // removes extra whitespace from the back and front
      index: true,
    },
    avatar: {
      type: String, // cloudinary url
      required: true,
    },
    coverImage: {
      type: String, // cloudinary url
    },
    watchHistory: [{ type: Schema.Types.ObjectId, ref: "Video" }],
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    refreshToken: {
      type: String,
    },
  },
  { timestamps: true }, // createdAt, updatedAt
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next(); // what is next? it is a function that moves to the next middleware
  this.password = await bcrypt.hash(this.password, 10); // what is 10? it is the number of rounds, the higher the number the more secure but slower
});

// defining our own instance method to check the password

//  Checks with the password in the database and the password that the user is trying to login with
userSchema.methods.checkPassword = async function (password) {
  return await bcrypt.compare(password, this.password); // returns a boolean
};

// Generates an access token (JWT token)
userSchema.methods.generateAccessToken = async function () {
  return jwt.sign(
    {
      _id: this.id,
      username: this.username,
      email: this.email,
      fullName: this.fullName,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    },
  );
};

//  Generates a refresh token (JWT token)
userSchema.methods.generateRefreshToken = async function () {
  return jwt.sign(
    {
      _id: this.id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    },
  );
};
export const User = mongoose.model("User", userSchema);
