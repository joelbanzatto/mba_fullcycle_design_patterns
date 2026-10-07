import InvoiceOutput from "../dto/InvoiceOutput";

export type InvoiceToSave = InvoiceOutput & {
	idContract: string;
};

export default interface InvoiceRepository {
	replacePeriod (month: number, year: number, type: string, invoices: InvoiceToSave[]): Promise<void>;
}
