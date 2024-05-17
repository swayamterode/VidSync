import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { cloudinaryUpload } from "../utils/cloudinary.js";
const registerUser = asyncHandler(async (req, res) => {
  const { username, email, fullName, password } = req.body;

  if ([fullName, email, password, username].includes(undefined)) {
    throw new ApiError(400, "Please provide all required fields");
  }

  if (!email.includes("@")) {
    throw new ApiError(400, "Please provide a valid email");
  }

  // Find user with same email or username
  const existingUser = await User.findOne({
    $or: [{ email }, { username }], // It returns true if any of the expressions are true.
  });

  // Check if user exists with same email or username
  if (existingUser) {
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
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
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

export { registerUser };
