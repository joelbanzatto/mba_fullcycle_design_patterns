import InvoiceGenerationFactory from "../../domain/InvoiceGenerationFactory";
import InvoiceOutput from "../dto/InvoiceOutput";
import Mediator from "../mediator/Mediator";
import PresenterFactory from "../presenter/PresenterFactory";
import ContractRepository from "../repository/ContractRepository";
import InvoiceRepository, { InvoiceToSave } from "../repository/InvoiceRepository";
import Usecase from "./Usecase";

export default class CloseInvoicing implements Usecase {

	constructor (
		readonly contractRepository: ContractRepository,
		readonly invoiceRepository: InvoiceRepository,
		readonly presenterFactory: PresenterFactory,
		readonly mediator: Mediator
	) {
	}

	async execute(input: Input): Promise<any> {
		const presenter = this.presenterFactory.create(input.format);
		InvoiceGenerationFactory.create(input.type);
		const contracts = await this.contractRepository.list();
		const invoices: InvoiceToSave[] = [];
		for (const contract of contracts) {
			for (const invoice of contract.generateInvoices(input.month, input.year, input.type)) {
				invoices.push({ idContract: contract.idContract, date: invoice.date, amount: invoice.amount });
			}
		}
		await this.invoiceRepository.replacePeriod(input.month, input.year, input.type, invoices);
		const output: Output[] = invoices.map(({ date, amount }) => ({ date, amount }));
		await this.mediator.publish("InvoicesClosed", {
			month: input.month,
			year: input.year,
			type: input.type,
			invoices: output.length,
			total: output.reduce((total, invoice) => total + invoice.amount, 0)
		});
		return presenter.present(output);
	}
}

type Input = {
	month: number,
	year: number,
	type: string,
	format?: string
};

export type Output = InvoiceOutput;
