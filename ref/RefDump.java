// 正解の全出力: モデルを 1 回（反復 1 回・長さは 1000 時間まで）流し、全オブジェクトの全出力を「名前.出力<TAB>値」で出す
// 使い方: java -cp JaamSim.jar:. RefDump モデル.cfg
import java.io.File;
import java.util.concurrent.CountDownLatch;
import com.jaamsim.basicsim.Entity;
import com.jaamsim.basicsim.JaamSimModel;
import com.jaamsim.basicsim.RunListener;
import com.jaamsim.input.InputAgent;
import com.jaamsim.input.ValueHandle;

public class RefDump {
	public static void main(String[] args) throws Exception {
		File file = new File(args[0]).getAbsoluteFile();
		JaamSimModel sm = new JaamSimModel(file.getName());
		sm.autoLoad();
		sm.setBatchRun(true);
		sm.configure(file);
		sm.postLoad();
		if (sm.getNumErrors() > 0) { System.out.println("入力のエラー\t" + sm.getNumErrors()); System.exit(2); }
		if (sm.getSimulation().getRunDuration() > 360000.0d)
			sm.setInput("Simulation", "RunDuration", "100 h");
		sm.setInput("Simulation", "NumberOfReplications", "1");
		sm.setInput("Simulation", "PauseTime", "");
		CountDownLatch done = new CountDownLatch(1);
		sm.start(new RunListener() {
			@Override public void runEnded() { done.countDown(); }
			@Override public void handleRuntimeError(JaamSimModel m, Throwable t) { System.out.println("実行の誤り\t" + t); done.countDown(); }
		}, null);
		done.await();
		double t = sm.getSimTime();
		System.out.println("simTime\t" + t);
		for (Entity ent : sm.getClonesOfIterator(Entity.class)) {
			for (ValueHandle out : ent.getAllOutputs()) {
				String s;
				try { s = InputAgent.getValueAsString(sm, out, t, "%s", 1.0d, ""); }
				catch (Throwable e) { s = "誤り " + e.getClass().getSimpleName(); }
				System.out.println(ent.getName() + "." + out.getName() + "\t" + s.replace('\n', ' '));
			}
		}
		System.exit(0);
	}
}
