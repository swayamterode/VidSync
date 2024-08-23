import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { cloudinaryUpload } from "../utils/cloudinary.js";
import fs from "fs";

const registerUser = asyncHandler(async (req, res) => {
  // getting username, email, fullName, and password from the request body
  const { username, email, fullName, password } = req.body;

  if ([fullName, email, password, username].includes(undefined)) {
    throw new ApiError(400, "Please provide all required fields");
  }

  if (!email.includes("@")) {
    throw new ApiError(400, "Please provide a valid email");
  }

  const passwordRegex =
    "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@$!%*?&])([a-zA-Z0-9@$!%*?&]{8,})$";
  if (!password.match(passwordRegex)) {
    throw new ApiError(
      400,
      "Password must contain at least 6 characters, including UPPER, LOWERCASE, Special Symbol and numbers",
    );
  }

  // Find user with same email or username
  const existingUser = await User.findOne({
    $or: [{ email }, { username }], // It returns true if any of the expressions are true.
  });

  // Check if user exists with same email or username
  if (existingUser) {
    fs.unlinkSync(req.files.avatar[0].path);
    fs.unlinkSync(req.files.coverImage[0].path);
    throw new ApiError(409, "User already exists with same email or username");
  }

  //  Avatar Image Upload
  const avatarLocalPath = req.files?.avatar[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Please provide an avatar image");
  }

  // Cover Image Upload
  let coverImageLocalPath;

  if (req.files && req.files.coverImage) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  const avatar = await cloudinaryUpload(avatarLocalPath);
  const coverImage = await cloudinaryUpload(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(500, "Cloudinary error uploading avatar image");
  }

  // Create user
  const user = await User.create({
    fullName,
    avatar: avatar.secure_url, // cloudinary image secure url
    coverImage: coverImage?.secure_url || "", // cloudinary cover image secure url
    email: email.toLowerCase(),
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  if (!createdUser) {
    throw new ApiError(500, "Error creating user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully!"));
});

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken; // save refresh token to database 🚀
    await user.save({ validateBeforeSave: false }); // save the user to the database

    return { accessToken, refreshToken }; // return the tokens
  } catch (error) {
    throw new ApiError(500, "Error generating tokens");
  }
};

const loginUser = asyncHandler(async (req, res) => {
  const { email, password, username } = req.body;

  if (!email && !username) {
    throw new ApiError(400, "Please provide email or username");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exists");
  }

  // Check if password is correct
  const isPasswordValid = await user.checkPassword(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  // Generate access token
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id,
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  // Cookie options
  const options = {
    httpOnly: true,
    secure: true,
  };

  // Send access token as cookie
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully",
      ),
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1, // this removes the field from document
      },
    },
    {
      new: true,
    },
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

export { registerUser, loginUser, logoutUser };
