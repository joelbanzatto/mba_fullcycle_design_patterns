export interface DatabaseTransaction {
	query (statement: string, params: any): Promise<any>;
}

export default interface DatabaseConnection extends DatabaseTransaction {
	transaction<T> (work: (transaction: DatabaseTransaction) => Promise<T>): Promise<T>;
	close (): Promise<void>;
}
