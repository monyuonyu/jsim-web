import com.jaamsim.math.*;
import com.jaamsim.datatypes.*;
public class Ref {
  static String h(double d){ return Long.toHexString(Double.doubleToRawLongBits(d)); }
  static void p(String k, double d){ System.out.println(k+" "+h(d)); }
  public static void main(String[] a){
    double[] xs={0.1,0.5,0.9,1.0,1.5,2.0,2.5,3.3,7.9,8.0,8.5,12.25,20.0,20.5,50.0,171.3,-0.5,-1.5,-2.7,-20.5,-25.3,1e-8};
    for(double x: xs){ p("gamma "+x, Gamma.gamma(x)); p("logGamma "+x, Gamma.logGamma(x)); }
    for(double x: new double[]{-0.5,-0.2,0.0,0.3,0.5,0.7,1.2,1.5}){ p("invGamma1pm1 "+x, Gamma.invGamma1pm1(x)); p("logGamma1p "+x, Gamma.logGamma1p(x)); }
    // 行列・四元数・変換
    Quaternion q=new Quaternion(); q.setEuler3(new Vec3d(0.3,-1.1,2.5));
    p("q.x",q.x);p("q.y",q.y);p("q.z",q.z);p("q.w",q.w);
    Vec3d e=q.getEuler3(); p("e.x",e.x);p("e.y",e.y);p("e.z",e.z);
    Mat4d m=new Mat4d(); m.setRot4(q); m.setTranslate3(new Vec3d(1.5,-2.25,3.125)); m.scale3(0.7);
    Mat4d m2=new Mat4d(1,2,3,4, 0.5,-1,2,0.25, 3,1,-2,1, 0,0,0,1);
    Mat4d m3=new Mat4d(); m3.mult4(m,m2);
    double[] d=m3.toCMDataArray(); for(int i=0;i<16;i++) p("m3["+i+"]",d[i]);
    p("det",m3.determinant());
    Mat4d inv=m3.inverse(); d=inv.toCMDataArray(); for(int i=0;i<16;i++) p("inv["+i+"]",d[i]);
    Mat4d eu=new Mat4d(); eu.setEuler4(new Vec3d(0.3,-1.1,2.5)); d=eu.toCMDataArray(); for(int i=0;i<16;i++) p("eu["+i+"]",d[i]);
    Transform t1=new Transform(new Vec3d(1,2,3), q, 2.5);
    Quaternion q2=new Quaternion(); q2.setAxisAngle(new Vec3d(1,1,0), 0.77);
    Transform t2=new Transform(new Vec3d(-4,0.5,7), q2, 0.3);
    Transform t3=new Transform(); t3.merge(t1,t2);
    Transform ti=new Transform(); t3.inverse(ti);
    Vec3d v=new Vec3d(0.1,0.2,0.3); Vec3d o=new Vec3d(); ti.multAndTrans(v,o); p("ti.x",o.x);p("ti.y",o.y);p("ti.z",o.z);
    d=t3.getMat4dRef().toCMDataArray(); for(int i=0;i<16;i++) p("t3["+i+"]",d[i]);
    Quaternion sl=new Quaternion(); q.slerp(q2,0.3,sl); p("sl.x",sl.x);p("sl.y",sl.y);p("sl.z",sl.z);p("sl.w",sl.w);
    Vec3d s3=new Vec3d(); Vec3d n1=new Vec3d(1,0,0), n2=new Vec3d(0,0.6,0.8); s3.slerp(n1,n2,0.4); p("s3.x",s3.x);p("s3.y",s3.y);p("s3.z",s3.z);
    Quaternion tv=Quaternion.transformVectors(new Vec4d(1,2,3,0), new Vec4d(-2,1,0.5,0)); p("tv.x",tv.x);p("tv.y",tv.y);p("tv.z",tv.z);p("tv.w",tv.w);
    Plane pl=new Plane(new Vec3d(0,0,1), new Vec3d(1,0,1.5), new Vec3d(0,2,1)); Ray r=new Ray(new Vec4d(0.2,0.3,5,1), new Vec4d(0.1,0.1,-1,0));
    p("pl.cd",pl.collisionDist(r));
    Plane pl2=new Plane(new Vec3d(0.3,0.4,0.5),2.0); Plane pl3=new Plane(new Vec3d(-1,0.2,0.1),-1.0);
    Vec3d cp=MathUtils.collidePlanes(pl,pl2,pl3); p("cp.x",cp.x);p("cp.y",cp.y);p("cp.z",cp.z);
    java.util.ArrayList<Vec3d> pts=new java.util.ArrayList<>(); pts.add(new Vec3d(1,2,3)); pts.add(new Vec3d(-1,0.5,2)); pts.add(new Vec3d(0.3,-4,1));
    AABB bb=new AABB(pts, m); p("bb.min.x",bb.minPt.x);p("bb.max.z",bb.maxPt.z);p("bb.cd",bb.collisionDist(new Ray(new Vec4d(10,10,10,1), new Vec4d(-1,-1,-1,0))));
    System.out.println("q.str "+q.toString()); System.out.println("t3.str "+t3.toString()); System.out.println("v4.str "+new Vec4d(1,-0.0,1e-5,1e7));
    // Interner
    Vec3dInterner in=new Vec3dInterner(); Vec3d z1=new Vec3d(0,0,0); Vec3d z2=new Vec3d(-0.0,-0.0,0); Vec3d z3=new Vec3d(-0.0,0,0); Vec3d z4=new Vec3d(0,0,0);
    System.out.println("intern "+(in.intern(z1)==z1)+" "+(in.intern(z2)==z1)+" "+(in.intern(z3)==z1)+" "+(in.intern(z4)==z1)+" "+in.getMaxIndex());
    // IntegerVector
    IntegerVector iv=new IntegerVector(); iv.add(2147483600); iv.add(100); iv.add(0,-5); System.out.println("iv "+iv+" "+iv.sum());
    IntegerVector pv=new IntegerVector(); pv.add(1);pv.add(3);pv.add(2); pv.nextPermutation(); System.out.println("perm "+pv);
    java.text.DecimalFormat f=new java.text.DecimalFormat("");
    for(double x: new double[]{0.0,-0.0,1.0,1.5,1234567.891,0.1+0.2,1e-7,123456789012.5,-2.5,0.0005,2.0/3.0,1e20,-1234.5}) System.out.println("df "+h(x)+" ["+f.format(x)+"]");
  }
}
