import * as dotenv from "dotenv";
import path = require("path");

// 1. Configure dotenv to read from our `.env` file
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// 2. Define a TS Type to type the returned envs from our function below.
export type ConfigProps = {
    ACCESS_LOGS_BUCKET: string;
    ENABLE_FLOW_LOGS: boolean;
    ENABLE_ALB_LOGS: boolean;
};

// 3. Define a function to retrieve our env variables
export const getConfig = (): ConfigProps => ({
    ACCESS_LOGS_BUCKET: process.env.REGION || " ",
    ENABLE_FLOW_LOGS: process.env.ENABLE_FLOW_LOGS === "true" || false,
    ENABLE_ALB_LOGS: process.env.ENABLE_ALB_LOGS === "true" || false,
});