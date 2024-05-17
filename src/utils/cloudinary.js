import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const cloudinaryUpload = async (localFilePath) => {
  try {
    if (!localFilePath) return null; // Local file path not provided
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    // console.log("UPLOADED FILE URL: ", response.url);
    fs.unlinkSync(localFilePath); // Delete the file from the local storage to avoid clutter
    return response; // this contains url, public_id, etc.
  } catch (error) {
    fs.unlinkSync(localFilePath); // Delete the file from the local storage to avoid clutter
    console.log("Error uploading file to cloudinary: ", error);
    return null;
  }
};

export { cloudinaryUpload };
