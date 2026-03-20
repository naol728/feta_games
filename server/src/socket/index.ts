import { Socket } from "socket.io"
import connectFourSocket from "./connectfour.socket"


export default function initSocket(io:any){

  io.on("connection",(socket:Socket)=>{

    console.log("user connected",socket.id)
    connectFourSocket(io,socket)
  })

}