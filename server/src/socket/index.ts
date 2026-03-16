import connectFourSocket from "./connectfour.socket"


export default function initSocket(io){

  io.on("connection",(socket)=>{

    console.log("user connected",socket.id)
    connectFourSocket(io,socket)
  })

}