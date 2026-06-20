"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { Loader2, ShieldCheck, Clock } from "lucide-react";

export default function VerificationQueuePage() {
    const [queue, setQueue] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchPendingShops();
    }, []);

    const fetchPendingShops = async () => {
        try {
            // Fetching only shops waiting for admin approval using the correct license_number column
            const { data, error } = await supabase
                .from("shops")
                .select("id, name, license_number, created_at")
                .eq("status", "PENDING")
                .order("created_at", { ascending: true }); // Oldest first

            if (error) throw error;
            setQueue(data || []);
        } catch (error) {
            console.error("Error fetching queue:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    };

    return (
        <div className="max-w-6xl space-y-8 animate-in fade-in duration-500">

            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-primary" /> Verification Queue
                </h1>
                <p className="text-muted-foreground text-sm">
                    {isLoading ? "Checking queue..." : `${queue.length} shops awaiting compliance approval, oldest first.`}
                </p>
            </div>

            {/* Queue Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm min-h-[400px] transition-colors duration-300">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                        <p className="font-mono text-sm uppercase tracking-widest">Scanning Database...</p>
                    </div>
                ) : queue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <Clock className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-lg font-bold text-foreground">Queue is Empty</p>
                        <p className="text-sm mt-1">All pharmacy registrations have been processed.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground font-mono">
                                <th className="p-5 font-medium">Pharmacy Name</th>
                                <th className="p-5 font-medium">License No.</th>
                                <th className="p-5 font-medium">Submitted On</th>
                                <th className="p-5 font-medium text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {queue.map((shop) => (
                                <tr key={shop.id} className="hover:bg-muted/50 transition-colors group">
                                    <td className="p-5 font-bold text-foreground">{shop.name || "Unnamed Shop"}</td>
                                    {/* Updated to use license_number */}
                                    <td className="p-5 text-sm text-foreground font-mono">{shop.license_number || "N/A"}</td>
                                    <td className="p-5 text-sm text-muted-foreground">{formatDate(shop.created_at)}</td>
                                    <td className="p-5 text-center">
                                        <Link
                                            href={`/admin/verification/${shop.id}`}
                                            className="inline-flex items-center justify-center px-6 py-2 bg-background border border-border text-foreground rounded-lg hover:border-primary hover:text-primary transition-colors text-sm font-medium shadow-sm"
                                        >
                                            Review
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}