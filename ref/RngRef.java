// 乱数の正解: いくつかの流れ・部分流で、最初の数個の一様乱数をビットの並び（16 進）で出す
import com.jaamsim.rng.MRG1999a;
public class RngRef {
	public static void main(String[] a) {
		int[][] cases = { {0,0}, {1,0}, {2,3}, {12345,0}, {99999,7}, {4999,1}, {5000,0} };
		for (int[] c : cases) {
			MRG1999a r = new MRG1999a(c[0], c[1]);
			StringBuilder sb = new StringBuilder(c[0] + " " + c[1]);
			for (int i = 0; i < 5; i++) sb.append(' ').append(Long.toHexString(Double.doubleToLongBits(r.nextUniform())));
			System.out.println(sb);
		}
	}
}
