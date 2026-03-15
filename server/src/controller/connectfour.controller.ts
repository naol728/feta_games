import { Request,Response } from "express"

export const getconnectfourrooms=(req:Request,res:Response)=>{
res.status(200).json({
    status:"Sucesses"
})
}