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
import { Copy } from "lucide-react";
export default function Deposit() {
    const { trxno } = useParams()
    const [transactionUrl, setTransactionUrl] = useState("")
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const text = tx.payment_method?.account_number || "";
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
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
            queryclient.invalidateQueries({ queryKey: ["gettransaction"] })
        },
        onError: (error) => {
            toast.error(error.message)
        }
    })

    const tx = data?.transaction

    return (
        <div className="p-3 space-y-3">

            {/* Header */}
            <div className="text-center">
                <h1 className="text-sm font-semibold">Deposit</h1>
            </div>

            {/* Loading */}
            {isLoading && (
                <Card>
                    <CardContent className="p-3 space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                    </CardContent>
                </Card>
            )}

            {/* Error */}
            {error && (
                <Card className="border-red-500/40">
                    <CardContent className="p-3 text-sm text-red-500">
                        Failed to load transaction
                    </CardContent>
                </Card>
            )}

            {/* Data */}
            {tx && (
                <Card className="rounded-2xl">

                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                            Deposit Status

                            <Badge
                                className={
                                    tx.status === "pending"
                                        ? "bg-yellow-500/20 text-yellow-600"
                                        : tx.status === "completed"
                                            ? "bg-green-500/20 text-green-600"
                                            : "bg-red-500/20 text-red-600"
                                }
                            >
                                {tx.status}
                            </Badge>
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-3 text-xs">

                        {/* Amount */}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="font-medium">{tx.amount} ETB</span>
                        </div>

                        {/* Type */}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Type</span>
                            <span className="capitalize">{tx.type}</span>
                        </div>

                        {/* Date */}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Date</span>
                            <span>
                                {new Date(tx.created_at).toLocaleString()}
                            </span>
                        </div>

                        {/* Account */}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Account</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCopy}
                            >
                                {copied ? "Copied!" : tx.payment_method?.account_number}
                                <Copy className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Account Holder Name</span>
                            <span>{tx.payment_method?.account_name}</span>
                        </div>

                        {/* Payment Method */}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Method</span>
                            <span className="truncate max-w-[140px] text-right">
                                {tx.payment_method.type}
                            </span>
                        </div>

                        {/* INPUT FIELD */}
                        <div className="pt-2 space-y-2">
                            <Input
                                placeholder="Enter transaction Url"
                                className="h-10 text-sm"
                                value={transactionUrl}
                                disabled={isPending || tx.status == "completed"} onChange={(e) => setTransactionUrl(e.target.value)}
                            />

                            <Button disabled={isPending || tx.status == "completed"}
                                onClick={() => mutate({ trxno, transactionUrl })}
                                className="w-full h-10 text-sm">
                                Verify Deposit
                            </Button>
                        </div>

                    </CardContent>
                </Card>
            )}
        </div>
    )
}