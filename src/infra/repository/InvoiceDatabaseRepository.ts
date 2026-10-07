import InvoiceOutput from "../../application/dto/InvoiceOutput";
import InvoiceRepository, { InvoiceToSave } from "../../application/repository/InvoiceRepository";
import DatabaseConnection from "../database/DatabaseConnection";

export default class InvoiceDatabaseRepository implements InvoiceRepository {

	constructor (readonly connection: DatabaseConnection) {
	}

	async replacePeriod(month: number, year: number, type: string, invoices: InvoiceToSave[]): Promise<void> {
		await this.connection.transaction(async transaction => {
			await transaction.query("delete from branas.invoice where month = $1 and year = $2 and type = $3", [month, year, type]);
			for (const invoice of invoices) {
				await transaction.query(
					"insert into branas.invoice (id_contract, month, year, type, date, amount) values ($1, $2, $3, $4, $5, $6)",
					[invoice.idContract, month, year, type, invoice.date, invoice.amount]
				);
			}
		});
	}

	async listByPeriod(month: number, year: number, type: string): Promise<InvoiceOutput[]> {
		const invoices = await this.connection.query(
			"select date, amount from branas.invoice where month = $1 and year = $2 and type = $3 order by date asc",
			[month, year, type]
		);
		return invoices.map((invoice: any) => ({ date: invoice.date, amount: parseFloat(invoice.amount) }));
	}
}
