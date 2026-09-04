import { gettransaction, varifytransaction } from "@/api/wallet"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "react-toastify"
import { useState } from "react"
import { Copy, Info } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { useAppDispatch } from "@/store/hook"
import { initAuth } from "@/store/slice/auth"

export default function Deposit() {
    const { trxno } = useParams()
    const dispatch = useAppDispatch()
    const [transactionUrl, setTransactionUrl] = useState("")
    const [copied, setCopied] = useState(false)
    const { data, isLoading, error } = useQuery({
        queryFn: () => gettransaction({ trxno }),
        queryKey: ["gettransaction", trxno],
    })
    const queryclient = useQueryClient()
    const { mutate, isPending } = useMutation({
        mutationFn: varifytransaction,
        mutationKey: ["varifytransaction"],
        onSuccess: (data) => {
            toast.success(data.message)
            dispatch(initAuth())
            queryclient.invalidateQueries({ queryKey: ["gettransaction"] })
        },
        onError: (error) => toast.error(error.message),
    })

    const tx = data?.transaction
    const accountNumber = tx?.payment_method?.account_number || ""

    const handleCopy = async () => {
        await navigator.clipboard.writeText(accountNumber)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <div className="space-y-3 p-3">
            <div className="flex items-center justify-between">
                <h1 className="text-sm font-semibold">Deposit</h1>
                {tx && (
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                                <Info className="h-3.5 w-3.5" />
                                How to deposit
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[calc(100%-2rem)] max-w-sm">
                            <DialogHeader>
                                <DialogTitle>How to deposit</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-5 text-sm">
                                <div className="space-y-3">
                                    <p className="text-muted-foreground">
                                        Deposit money to the following Telebirr account:
                                    </p>

                                    <div className="flex items-center justify-center gap-3 rounded-lg bg-muted px-4 py-3">
                                        <Button variant="ghost" size="sm" onClick={handleCopy}>
                                            {copied ? "Copied!" : accountNumber}
                                            <Copy className="ml-2 h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <p className="text-muted-foreground">
                                        And then please add the transaction reference in the form below
                                    </p>

                                    <p className="mt-3 text-xs text-muted-foreground">
                                        Example Transaction ID:{" "}
                                        <strong className="text-foreground font-semibold">
                                            CE535PPHGP
                                        </strong>
                                    </p>
                                </div>
                            </div>

                        </DialogContent>

                    </Dialog>
                )}
            </div>

            {isLoading && (
                <Card>
                    <CardContent className="space-y-2 p-3">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                    </CardContent>
                </Card>
            )}

            {error && (
                <Card className="border-red-500/40">
                    <CardContent className="p-3 text-sm text-red-500">
                        Failed to load transaction
                    </CardContent>
                </Card>
            )}

            {tx && (
                <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-sm">
                            Deposit Status
                            <Badge className={tx.status === "pending" ? "bg-yellow-500/20 text-yellow-600" : tx.status === "completed" ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"}>
                                {tx.status}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="font-medium">{tx.amount} ETB</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Type</span>
                            <span className="capitalize">{tx.type}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Date</span>
                            <span>{new Date(tx.created_at).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Account</span>
                            <Button variant="ghost" size="sm" onClick={handleCopy}>
                                {copied ? "Copied!" : accountNumber}
                                <Copy className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Account Holder Name</span>
                            <span>{tx.payment_method?.account_name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Method</span>
                            <span className="max-w-[140px] truncate text-right">{tx.payment_method.type}</span>
                        </div>
                        <div className="space-y-2 pt-2">
                            <p className="text-muted-foreground">
                                Enter the transaction reference from your Telebirr receipt.
                            </p>
                            <Input
                                placeholder="Example: CE535PPHGP"
                                className="h-10 text-sm"
                                value={transactionUrl}
                                disabled={isPending || tx.status === "completed"}
                                onChange={(e) => setTransactionUrl(e.target.value)}
                            />
                            <Button
                                disabled={isPending || tx.status === "completed" || transactionUrl.length < 5}
                                onClick={() => mutate({ trxno, transactionUrl })}
                                className="h-10 w-full text-sm"
                            >
                                Verify Deposit
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}