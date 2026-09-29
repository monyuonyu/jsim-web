// 数を文字列にする正解: Double.toString と String.format の結果（1 行に 1 つ、タブ区切り）
public class FmtRef {
	public static void main(String[] a) {
		double[] xs = { 0.0, -0.0, 1.0, -1.5, 0.1, 0.001, 0.0009999, 1e7, 9999999.0, 12345678.9, 1.005, 2.675, 0.125,
			1e-5, 3.14159265358979, 1e21, 1.0/3, 2.0/3, 100.0, 123456.789, 0.5, 1.5, 2.5, -2.5, 9.995, 0.045, 1e300, 5e-324,
			Double.NaN, Double.POSITIVE_INFINITY, 42.0, 0.30000000000000004, 1234.5678, 9.012822617527148, 0.7991412430805556 };
		String[] fmts = { "%s", "%.2f", "%.3f", "%f", "%.0f", "%e", "%.3e", "%g", "%.4g", "%10.2f", "%-10.2f|", "%,.2f", "%010.3f", "%+.1f" };
		for (double x : xs) {
			StringBuilder sb = new StringBuilder(Long.toHexString(Double.doubleToLongBits(x)));
			sb.append('\t').append(Double.toString(x));
			for (String f : fmts)
				sb.append('\t').append(f.equals("%s") ? String.format(f, Double.toString(x)) : String.format(f, x));
			System.out.println(sb);
		}
		long[] ns = { 0, 1, -1, 1234567, -9876543210L };
		for (long n : ns)
			System.out.println("D\t" + n + "\t" + String.format("%d|%,d|%8d|%-8d|%08d|%+d", n, n, n, n, n, n));
	}
}
