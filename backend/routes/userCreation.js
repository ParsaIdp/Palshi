import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { dirname } from "path";
import express from "express";

import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url); // Get the current file path
const __dirname = dirname(__filename); // Get the directory name from the file path

const router = express.Router();

dotenv.config({ path: path.resolve(__dirname, "../.env") });
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;
console.log(supabaseUrl);
console.log(supabaseKey);
const supabase = createClient(supabaseUrl, supabaseKey);

async function signUp(req, res) {
  if (!(req.body.username && req.body.password && req.body.confirm_password)) {
    return res.status(400).json({ error: "Request Body Incomplete" });
  }
  const { username, password, confirm_password } = req.body;

  if (password !== confirm_password) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  const { data, error } = await supabase
    .from("users")
    .insert([{ username, pswd: password, balance: 1000.0 }]);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({ user: data });
}

router.post("/signup", signUp);

export default router;
