import express from "express"
import { getconnectfourrooms } from "../controller/connectfour.controller"

const route=express.Router()
route.get("/",getconnectfourrooms)

export default route