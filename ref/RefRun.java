// 正解の結果を取る道具: JaamSim（Java 版）でモデルを画面なしで最後まで流し、RunOutputList の値を 1 行ずつ出す
// 使い方: java -cp JaamSim.jar:. RefRun モデル.cfg
import java.io.File;
import java.util.concurrent.CountDownLatch;
import com.jaamsim.basicsim.JaamSimModel;
import com.jaamsim.basicsim.RunListener;

public class RefRun {
	public static void main(String[] args) throws Exception {
		File file = new File(args[0]).getAbsoluteFile();
		JaamSimModel sm = new JaamSimModel(file.getName());
		sm.autoLoad();
		sm.setBatchRun(true);
		sm.configure(file);
		sm.postLoad();
		if (sm.getNumErrors() > 0) {
			System.out.println("入力のエラー: " + sm.getNumErrors() + " 件");
			System.exit(2);
		}
		CountDownLatch done = new CountDownLatch(1);
		sm.start(new RunListener() {
			@Override public void runEnded() { done.countDown(); }
			@Override public void handleRuntimeError(JaamSimModel m, Throwable t) { t.printStackTrace(); System.exit(3); }
		}, null);
		done.await();
		System.out.println("simTime\t" + sm.getSimTime());
		for (String s : sm.getSimulation().getRunOutputStrings(sm.getSimTime()))
			System.out.println(s);
		System.exit(0);
	}
}
