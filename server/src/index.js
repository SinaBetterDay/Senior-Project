import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import adminSourcesRouter from "./routes/admin/sources.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

app.use("/api/admin", adminSourcesRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});