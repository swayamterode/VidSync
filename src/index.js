import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";
dotenv.config({
  path: "./.env",
});

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(`Server is running on port: ${process.env.PORT || 8000}`);
      app.on("error", (error) => console.log("Error on server: ", error));
    });
  })
  .catch((error) => {
    console.log("Error connecting to MongoDB.....", error);
    process.exit(1);
  });
