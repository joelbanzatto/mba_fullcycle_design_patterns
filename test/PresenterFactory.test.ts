import CsvPresenter from "../src/infra/presenter/CsvPresenter";
import JsonPresenter from "../src/infra/presenter/JsonPresenter";
import PresenterFactory from "../src/infra/presenter/PresenterFactory";

const factory = new PresenterFactory();
const invoices = [
	{ date: new Date("2022-01-01T13:00:00Z"), amount: 500 },
	{ date: new Date("2022-01-05T13:00:00Z"), amount: 6000 }
];

test.each([undefined, "json"])("selects JSON for format %s", function (format) {
	const presenter = factory.create(format);
	expect(presenter).toBeInstanceOf(JsonPresenter);
	expect(presenter.present(invoices)).toEqual(invoices);
});

test("selects CSV with one line per invoice", function () {
	const presenter = factory.create("csv");
	expect(presenter).toBeInstanceOf(CsvPresenter);
	expect(presenter.present(invoices)).toBe("2022-01-01;500\n2022-01-05;6000");
});

test("presents an empty invoice list as empty CSV", function () {
	expect(factory.create("csv").present([])).toBe("");
});

test.each(["xml", "", "JSON"])("rejects unsupported format %s", function (format) {
	expect(() => factory.create(format)).toThrow(new Error("Invalid format"));
});
