export default interface Presenter<T> {
	present (output: T): unknown;
}
