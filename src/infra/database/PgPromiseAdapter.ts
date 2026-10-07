import DatabaseConnection, { DatabaseTransaction } from "./DatabaseConnection";
import pgp from "pg-promise";

export default class PgPromiseAdapter implements DatabaseConnection {
	connection: any;

	constructor () {
		this.connection = pgp()("postgres://postgres:123456@localhost:5432/app");
	}

	query(statement: string, params: any): Promise<any> {
		return this.connection.query(statement, params);
	}

	transaction<T>(work: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
		return this.connection.tx((transaction: DatabaseTransaction) => work({
			query: (statement, params) => transaction.query(statement, params)
		}));
	}

	close(): Promise<void> {
		return this.connection.$pool.end();
	}

}
