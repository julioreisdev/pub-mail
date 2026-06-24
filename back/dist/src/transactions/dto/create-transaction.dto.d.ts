export declare class CreateTransactionDto {
    amount: string;
    type: string;
    description: string;
    provider_transaction_id?: string;
    operation: 'CREDIT' | 'DEBIT';
}
