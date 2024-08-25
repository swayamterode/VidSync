import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { cloudinaryUpload } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import fs from "fs";

/**
 * Registers a new user.
 *
 * @async
 * @function registerUser
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @throws {ApiError} If any required field is missing or invalid.
 * @throws {ApiError} If the email is already taken by another user.
 * @throws {ApiError} If there is an error uploading the avatar image to Cloudinary.
 * @throws {ApiError} If there is an error creating the user.
 * @returns {Object} The response object with the registered user information.
 */
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

/**
 * Generates access and refresh tokens for a given user ID.
 *
 * @param {string} userId - The ID of the user.
 * @returns {Promise<{accessToken: string, refreshToken: string}>} - The generated access and refresh tokens.
 * @throws {ApiError} If the user is not found or there is an error generating tokens.
 */
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

/**
 * Logs in a user.
 *
 * @async
 * @function loginUser
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @throws {ApiError} 400 - If email or username is not provided.
 * @throws {ApiError} 404 - If user does not exist.
 * @throws {ApiError} 401 - If user credentials are invalid.
 * @returns {Object} The response object with access and refresh tokens.
 */
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

/**
 * Logout user and clear access and refresh tokens from cookies.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Object} - The response object with status 200 and a JSON message indicating successful logout.
 */
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

/**
 * Refreshes the access token for the user.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Object} - The response object with updated access token and refresh token.
 * @throws {ApiError} - If there is an error refreshing the access token.
 */
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken; // get refresh token from cookies or request body in case of mobile
  if (incomingRefreshToken) {
    throw new ApiError(400, "Refresh token is required");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.ACCESS_TOKEN_SECRET,
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(404, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(400, "Invalid refresh token or token is expired");
    }

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);
    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Access token refreshed successfully",
        ),
      );
  } catch (error) {
    throw new ApiError(500, error?.message || "Error refreshing access token");
  }
});

/**
 * Changes the current password of a user.
 *
 * @async
 * @function changeCurrentPassword
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Object} The response object with a success message.
 * @throws {ApiError} If the old password is invalid.
 */
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.body?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(404, "Old Password is invalid");
  }

  user.password = newPassword;
  user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

/**
 * Retrieves the current user's details.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Object} The response object with the current user's details.
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Fetched User detailed successfully"));
});

/**
 * Updates the account details of a user.
 *
 * @async
 * @function updateAccountDetails
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Object} The updated user data.
 * @throws {ApiError} If fullName or email is missing.
 */
const updateAccountDetails = asyncHandler(async (req, res) => {
  try {
    const { fullName, email } = req.body;
    if (!fullName || !email) {
      throw new ApiError(400, "All fields are required");
    }
    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          fullName,
          email,
        },
      },
      { new: true },
    ).select("-password");

    return res
      .status(200)
      .json(new ApiResponse(200, user, "Updated user data successfully"));
  } catch (error) {
    return res
      .status(400)
      .json(new ApiError(400, {}, "Error while updating user details"));
  }
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
};
