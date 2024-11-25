import express from "express";
import dotenv from "dotenv";
import marketRouter from "./routes/marketHandling.js"; // Assuming marketHandling is in the same directory
import userRouter from "./routes/userCreation.js";
import morgan from "morgan";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(morgan("dev")); // Adding morgan for logging HTTP requests
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/market", marketRouter); // Registering the marketHandling router
app.use("/user", userRouter);
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
