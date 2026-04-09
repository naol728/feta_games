import { Request, Response } from "express";

export const deposit = (req: Request, res: Response) => {
  const { amount, phonno, transactionno } = req.body;
  res.status(200).json({
    message: "Deposited Sucessfully",
  });
};
