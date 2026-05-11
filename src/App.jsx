import { useState, useEffect } from "react";

/* ─── Supabase config ────────────────────────────────────────────────────────── */
const SUPA_URL = "https://brbyukzbxtagheeexrsl.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyYnl1a3pieHRhZ2hlZWV4cnNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzg3ODUsImV4cCI6MjA5MzcxNDc4NX0.DmHKYvhgjtLru-GHuUkkmrw4SGVRYNul0MeApM3gmcY";

const db = async (path, options = {}) => {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "return=representation",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "خطأ في قاعدة البيانات");
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

/* ─── STATUS ────────────────────────────────────────────────────────────────── */
const STATUS = {
  pending:  { label: "في الانتظار", color: "#F59E0B", bg: "#FFFBEB", icon: "⏳" },
  approved: { label: "مقبول",       color: "#10B981", bg: "#ECFDF5", icon: "✅" },
  rejected: { label: "مرفوض",       color: "#EF4444", bg: "#FEF2F2", icon: "❌" },
};

/* ─── helpers ───────────────────────────────────────────────────────────────── */
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("ar-DZ", { day: "numeric", month: "long" }) + " " +
         d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
};

/* ══════════════════════════════════════════════════════════════════════════════ */
export default function Sehti() {
  const [stack,      setStack]      = useState(["landing"]);
  const [doctors,    setDoctors]    = useState([]);
  const [requests,   setRequests]   = useState([]);
  const [loggedDoc,  setLoggedDoc]  = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass,  setLoginPass]  = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoad,  setLoginLoad]  = useState(false);
  const [bookDoc,    setBookDoc]    = useState(null);
  const [bookForm,   setBookForm]   = useState({ name:"", age:"", phone:"", reason:"" });
  const [bookDone,   setBookDone]   = useState(null);
  const [bookLoad,   setBookLoad]   = useState(false);
  const [detailReq,  setDetailReq]  = useState(null);
  const [timeInput,  setTimeInput]  = useState("09:00");
  const [dTab,       setDTab]       = useState("pending");
  const [specFilter, setSpecFilter] = useState("الكل");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  const screen = stack[stack.length - 1];
  const push   = (s) => setStack(p => [...p, s]);
  const pop    = () => setStack(p => p.length > 1 ? p.slice(0, -1) : p);
  const goHome = () => setStack(["landing"]);
  const logout = () => { setLoggedDoc(null); setStack(["landing"]); };

  /* ── load doctors on mount ── */
  useEffect(() => {
    db("doctors?select=*&order=name").then(setDoctors).catch(() => {});
  }, []);

  /* ── load requests when doctor logs in ── */
  useEffect(() => {
    if (!loggedDoc) return;
    loadRequests();
  }, [loggedDoc]);

  const loadRequests = async () => {
    if (!loggedDoc) return;
    setLoading(true);
    try {
      const data = await db(`appointments?doctor_id=eq.${loggedDoc.id}&order=created_at.desc`);
      setRequests(data);
    } catch (e) {
      setError("تعذر تحميل الطلبات");
    }
    setLoading(false);
  };

  /* ── login ── */
  const handleLogin = async () => {
    setLoginLoad(true);
    setLoginError("");
    try {
      const data = await db(`doctors?email=eq.${encodeURIComponent(loginEmail.trim())}&password=eq.${encodeURIComponent(loginPass)}&select=*`);
      if (data.length > 0) {
        setLoggedDoc(data[0]);
        push("doctor_dashboard");
      } else {
        setLoginError("البريد الإلكتروني أو كلمة السر غير صحيحة");
      }
    } catch {
      setLoginError("حدث خطأ، حاول مرة أخرى");
    }
    setLoginLoad(false);
  };

  /* ── submit booking ── */
  const submitBooking = async () => {
    if (!bookForm.name || !bookForm.phone || !bookForm.reason || !bookDoc) return;
    setBookLoad(true);
    try {
      const data = await db("appointments", {
        method: "POST",
        body: JSON.stringify({
          doctor_id: bookDoc.id,
          patient_name: bookForm.name,
          patient_age: parseInt(bookForm.age) || 0,
          patient_phone: bookForm.phone,
          reason: bookForm.reason,
          status: "pending",
        }),
      });
      setBookDone(data[0] || { ...bookForm, doctor_id: bookDoc.id });
      setBookForm({ name:"", age:"", phone:"", reason:"" });
      push("booking_success");
    } catch {
      setError("تعذر إرسال الطلب، حاول مرة أخرى");
    }
    setBookLoad(false);
  };

  /* ── approve ── */
  const approveReq = async (id) => {
    try {
      await db(`appointments?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved", appointment_time: timeInput }),
      });
      setRequests(p => p.map(r => r.id===id ? {...r, status:"approved", appointment_time: timeInput} : r));
      setDetailReq(p => p && p.id===id ? {...p, status:"approved", appointment_time: timeInput} : p);
      pop();
    } catch {
      setError("تعذر تحديث الطلب");
    }
  };

  /* ── reject ── */
  const rejectReq = async (id) => {
    try {
      await db(`appointments?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "rejected" }),
      });
      setRequests(p => p.map(r => r.id===id ? {...r, status:"rejected"} : r));
      setDetailReq(p => p && p.id===id ? {...p, status:"rejected"} : p);
      pop();
    } catch {
      setError("تعذر تحديث الطلب");
    }
  };

  const specs       = ["الكل", ...Array.from(new Set(doctors.map(d => d.specialty)))];
  const filteredDocs= specFilter==="الكل" ? doctors : doctors.filter(d => d.specialty===specFilter);
  const myRequests  = requests;
  const pendingList = myRequests.filter(r => r.status==="pending");
  const approvedList= myRequests.filter(r => r.status==="approved");
  const tabList     = dTab==="pending" ? pendingList : dTab==="approved" ? approvedList : myRequests;

  /* ════════════════════════ RENDER ══════════════════════════════════════════ */
  return (
    <Shell>
      {error && (
        <div onClick={()=>setError("")} style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:"#EF4444",color:"#fff",padding:"10px 20px",borderRadius:14,fontSize:13,fontWeight:700,zIndex:999,cursor:"pointer",maxWidth:380,textAlign:"center"}}>
          ⚠️ {error} — اضغط للإغلاق
        </div>
      )}

      {/* ── LANDING ── */}
      {screen==="landing" && (
        <div style={{flex:1,display:"flex",flexDirection:"column",background:"linear-gradient(160deg,#F0F9FF,#E0F2FE)"}}>
          <div style={{padding:"52px 28px 36px",textAlign:"center"}}>
            <div style={{width:86,height:86,borderRadius:26,background:"linear-gradient(135deg,#0F4C75,#1B6CA8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:44,margin:"0 auto 18px",boxShadow:"0 14px 40px rgba(15,76,117,.3)"}}>🩺</div>
            <h1 style={{fontSize:34,fontWeight:900,color:"#0F4C75",letterSpacing:-1}}>صحتي</h1>
            <p style={{color:"#64748B",fontSize:13,marginTop:10,lineHeight:1.9}}>منصة حجز المواعيد الطبية<br/>بسهولة وسرعة</p>
          </div>
          <div style={{flex:1,padding:"0 24px 48px",display:"flex",flexDirection:"column",gap:16}}>
            <LandingCard icon="📅" color="#1B6CA8" title="حجز موعد طبي" sub="اختر طبيبك وأرسل طلب حجز"
              onClick={() => { setBookDoc(null); setBookDone(null); push("booking"); }}/>
            <LandingCard icon="🔐" color="#0F4C75" title="الدخول لحسابي" sub="بوابة الأطباء — إدارة الطلبات"
              onClick={() => { setLoginEmail(""); setLoginPass(""); setLoginError(""); push("doctor_login"); }}/>
          </div>
        </div>
      )}

      {/* ── BOOKING ── */}
      {screen==="booking" && (
        <>
          <Header title="حجز موعد طبي" onBack={goHome} gradient="linear-gradient(160deg,#1B6CA8,#2563EB)"/>
          <div style={{flex:1,overflowY:"auto",background:"#F8FAFC"}}>
            <div style={{padding:"16px 16px 0"}}>
              <p style={{fontWeight:800,fontSize:13,color:"#334155",marginBottom:10}}>التخصص</p>
              <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
                {specs.map(s => (
                  <button key={s} onClick={()=>setSpecFilter(s)} style={{flexShrink:0,padding:"7px 14px",borderRadius:20,border:"2px solid",borderColor:specFilter===s?"#1B6CA8":"#E2E8F0",background:specFilter===s?"#1B6CA8":"#fff",color:specFilter===s?"#fff":"#64748B",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Cairo,sans-serif"}}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{padding:"16px 16px 24px"}}>
              <p style={{fontWeight:800,fontSize:13,color:"#334155",marginBottom:10}}>الأطباء المتوفرون</p>
              {doctors.length===0 && <Spinner/>}
              {filteredDocs.map(doc => (
                <div key={doc.id} onClick={()=>{if(doc.available){setBookDoc(doc);push("booking_form");}}}
                  style={{background:"#fff",borderRadius:18,padding:"14px 16px",marginBottom:12,boxShadow:"0 2px 12px rgba(0,0,0,.06)",border:`2px solid ${bookDoc?.id===doc.id?"#1B6CA8":"#E2E8F0"}`,cursor:doc.available?"pointer":"not-allowed",opacity:doc.available?1:.55,transition:"all .2s"}}>
                  <div style={{display:"flex",gap:14,alignItems:"center"}}>
                    <div style={{width:54,height:54,borderRadius:16,background:"linear-gradient(135deg,#EFF6FF,#DBEAFE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>{doc.avatar}</div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div>
                          <p style={{fontWeight:800,fontSize:15,color:"#1E293B"}}>{doc.name}</p>
                          <p style={{fontSize:12,color:"#64748B",marginTop:2}}>{doc.specialty}</p>
                          <p style={{fontSize:11,color:"#94A3B8",marginTop:1}}>{doc.clinic}</p>
                        </div>
                        <div style={{textAlign:"center"}}>
                          <span style={{background:doc.available?"#ECFDF5":"#F1F5F9",color:doc.available?"#10B981":"#94A3B8",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:800}}>{doc.available?"متاح":"غير متاح"}</span>
                          <p style={{fontSize:12,color:"#F59E0B",fontWeight:700,marginTop:4}}>⭐ {doc.rating}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {doc.available && <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #F1F5F9",display:"flex",justifyContent:"flex-end"}}><span style={{fontSize:12,fontWeight:700,color:"#1B6CA8"}}>احجز موعد ←</span></div>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── BOOKING FORM ── */}
      {screen==="booking_form" && bookDoc && (
        <>
          <Header title="تفاصيل الحجز" onBack={pop} gradient="linear-gradient(160deg,#1B6CA8,#2563EB)"/>
          <div style={{flex:1,overflowY:"auto",padding:"20px 16px 32px"}}>
            <div style={{background:"linear-gradient(135deg,#EFF6FF,#DBEAFE)",borderRadius:16,padding:"14px 16px",marginBottom:24,display:"flex",gap:14,alignItems:"center",border:"2px solid #BFDBFE"}}>
              <div style={{fontSize:36}}>{bookDoc.avatar}</div>
              <div>
                <p style={{fontWeight:900,fontSize:15,color:"#1E3A8A"}}>{bookDoc.name}</p>
                <p style={{fontSize:12,color:"#3B82F6",marginTop:2}}>{bookDoc.specialty} · {bookDoc.clinic}</p>
              </div>
            </div>
            <p style={{fontWeight:800,fontSize:14,color:"#334155",marginBottom:16}}>بياناتك</p>
            {[["name","👤","الاسم الكامل","أدخل اسمك الكامل","text"],["age","🎂","العمر","مثال: 35","number"],["phone","📱","رقم الهاتف","0600 000 000","tel"]].map(([key,icon,label,ph,type])=>(
              <div key={key} style={{marginBottom:16}}>
                <label style={LST}>{icon} {label}</label>
                <input type={type} value={bookForm[key]} onChange={e=>setBookForm(f=>({...f,[key]:e.target.value}))} placeholder={ph} style={IST}/>
              </div>
            ))}
            <div style={{marginBottom:28}}>
              <label style={LST}>📝 سبب الزيارة</label>
              <textarea value={bookForm.reason} onChange={e=>setBookForm(f=>({...f,reason:e.target.value}))} placeholder="اشرح شكواك باختصار..." rows={4} style={{...IST,resize:"none"}}/>
            </div>
            <Btn onClick={submitBooking} disabled={!bookForm.name||!bookForm.phone||!bookForm.reason||bookLoad}
              style={{...PB,width:"100%",opacity:(!bookForm.name||!bookForm.phone||!bookForm.reason||bookLoad)?.5:1}}>
              {bookLoad ? "جاري الإرسال..." : "إرسال طلب الحجز ✓"}
            </Btn>
          </div>
        </>
      )}

      {/* ── BOOKING SUCCESS ── */}
      {screen==="booking_success" && bookDoc && (
        <>
          <Header title="تم الإرسال" onBack={goHome} gradient="linear-gradient(160deg,#1B6CA8,#2563EB)" backLabel="الرئيسية"/>
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 24px",textAlign:"center"}}>
            <div style={{width:90,height:90,borderRadius:"50%",background:"linear-gradient(135deg,#10B981,#34D399)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:44,marginBottom:24,boxShadow:"0 10px 30px rgba(16,185,129,.3)"}}>✓</div>
            <h2 style={{fontSize:22,fontWeight:900,color:"#065F46",marginBottom:10}}>تم إرسال طلبك!</h2>
            <p style={{color:"#64748B",fontSize:14,lineHeight:1.9,marginBottom:28}}>أرسلنا طلب حجزك إلى<br/><strong style={{color:"#1B6CA8"}}>{bookDoc.name}</strong><br/>سيتم التواصل معك عند القبول.</p>
            <div style={{background:"#F8FAFC",borderRadius:18,padding:18,width:"100%",marginBottom:24,border:"1.5px solid #E2E8F0",textAlign:"right"}}>
              {[["المريض",bookDone?.patient_name||bookForm.name],["الهاتف",bookDone?.patient_phone||bookForm.phone],["الطبيب",bookDoc.name],["الحالة","⏳ في الانتظار"]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #F1F5F9"}}>
                  <span style={{fontSize:12,color:"#94A3B8"}}>{k}</span>
                  <span style={{fontSize:13,fontWeight:700,color:"#334155"}}>{v}</span>
                </div>
              ))}
            </div>
            <Btn onClick={goHome} style={{...PB,width:"100%"}}>العودة للرئيسية 🏠</Btn>
          </div>
        </>
      )}

      {/* ── DOCTOR LOGIN ── */}
      {screen==="doctor_login" && (
        <>
          <Header title="دخول الطبيب" onBack={goHome} gradient="linear-gradient(160deg,#0F4C75,#1B6CA8)"/>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"32px 24px"}}>
            <div style={{textAlign:"center",marginBottom:32}}>
              <div style={{fontSize:52,marginBottom:12}}>🩺</div>
              <h2 style={{fontWeight:900,fontSize:20,color:"#0F4C75"}}>بوابة الأطباء</h2>
              <p style={{color:"#64748B",fontSize:13,marginTop:6}}>أدخل بياناتك للدخول للوحة التحكم</p>
            </div>
            <div style={{marginBottom:16}}>
              <label style={LST}>📧 البريد الإلكتروني</label>
              <input value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="doctor@sehti.dz" style={{...IST,direction:"ltr",textAlign:"right"}}/>
            </div>
            <div style={{marginBottom:8}}>
              <label style={LST}>🔑 كلمة السر</label>
              <input type="password" value={loginPass} onChange={e=>setLoginPass(e.target.value)} placeholder="••••••••" style={{...IST,direction:"ltr",textAlign:"right"}} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
            </div>
            {loginError && <p style={{color:"#EF4444",fontSize:12,marginBottom:12,textAlign:"center",background:"#FEF2F2",padding:"8px 12px",borderRadius:10}}>{loginError}</p>}
            <p style={{fontSize:11,color:"#94A3B8",textAlign:"center",marginBottom:20}}>للتجربة: kamal@sehti.dz · كلمة السر: 1234</p>
            <Btn onClick={handleLogin} disabled={!loginEmail||!loginPass||loginLoad} style={{...PB,width:"100%",opacity:(!loginEmail||!loginPass||loginLoad)?.5:1}}>
              {loginLoad ? "جاري التحقق..." : "دخول ←"}
            </Btn>
          </div>
        </>
      )}

      {/* ── DOCTOR DASHBOARD ── */}
      {screen==="doctor_dashboard" && loggedDoc && (
        <>
          <div style={{background:"linear-gradient(160deg,#0F4C75,#1B6CA8)",padding:"24px 20px 20px",flexShrink:0,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-40,right:-40,width:150,height:150,borderRadius:"50%",background:"rgba(255,255,255,.05)"}}/>
            <button onClick={logout} style={{background:"rgba(255,255,255,.18)",border:"none",borderRadius:12,padding:"7px 14px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Cairo,sans-serif",display:"inline-flex",alignItems:"center",gap:6}}>
              ← خروج من الحساب
            </button>
            <div style={{marginTop:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <p style={{color:"rgba(255,255,255,.6)",fontSize:12}}>مرحباً،</p>
                <h2 style={{color:"#fff",fontSize:18,fontWeight:900}}>{loggedDoc.name}</h2>
                <p style={{color:"rgba(255,255,255,.6)",fontSize:12,marginTop:2}}>{loggedDoc.specialty}</p>
              </div>
              <div style={{display:"flex",gap:10}}>
                {[["انتظار",pendingList.length,"#F59E0B"],["مقبول",approvedList.length,"#10B981"]].map(([l,v,c])=>(
                  <div key={l} style={{background:"rgba(255,255,255,.12)",borderRadius:12,padding:"8px 14px",textAlign:"center"}}>
                    <p style={{color:c,fontWeight:900,fontSize:20}}>{v}</p>
                    <p style={{color:"rgba(255,255,255,.6)",fontSize:10}}>{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{display:"flex",background:"#fff",borderBottom:"1.5px solid #E2E8F0",flexShrink:0}}>
            {[["pending","في الانتظار"],["approved","المقبولة"],["all","الكل"]].map(([k,l])=>(
              <button key={k} onClick={()=>setDTab(k)} style={{flex:1,padding:"13px 4px",border:"none",background:"none",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"Cairo,sans-serif",color:dTab===k?"#0F4C75":"#94A3B8",borderBottom:dTab===k?"3px solid #0F4C75":"3px solid transparent",transition:"all .2s"}}>
                {l}{k==="pending"&&pendingList.length>0&&<span style={{background:"#F59E0B",color:"#fff",borderRadius:20,fontSize:10,fontWeight:900,padding:"1px 6px",marginRight:4}}>{pendingList.length}</span>}
              </button>
            ))}
          </div>

          <div style={{flex:1,overflowY:"auto",padding:"16px 16px 32px",background:"#F8FAFC"}}>
            {loading ? <Spinner/> : tabList.length===0 ? <Empty/> : tabList.map(r=>(
              <div key={r.id} className="fi" style={{background:"#fff",borderRadius:18,padding:"14px 16px",marginBottom:12,boxShadow:"0 2px 12px rgba(0,0,0,.06)",border:"1.5px solid #E2E8F0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <p style={{fontWeight:800,fontSize:15,color:"#1E293B"}}>{r.patient_name}</p>
                    <p style={{fontSize:12,color:"#94A3B8",marginTop:2}}>{r.patient_age} سنة · {r.patient_phone}</p>
                    <p style={{fontSize:11,color:"#CBD5E1",marginTop:1}}>{fmtDate(r.created_at)}</p>
                  </div>
                  <Badge status={r.status}/>
                </div>
                <div style={{background:"#F8FAFC",borderRadius:10,padding:"8px 12px",marginBottom:10}}>
                  <p style={{fontSize:12,color:"#64748B",lineHeight:1.7}}>{r.reason}</p>
                </div>
                {r.appointment_time&&<p style={{fontSize:12,fontWeight:700,color:"#10B981",marginBottom:10}}>📅 الساعة {r.appointment_time}</p>}
                <button onClick={()=>{setDetailReq(r);setTimeInput("09:00");push("doctor_detail");}} style={{width:"100%",padding:"10px",borderRadius:12,border:"1.5px solid #E2E8F0",background:"#fff",color:"#334155",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Cairo,sans-serif"}}>
                  عرض التفاصيل ←
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── DOCTOR DETAIL ── */}
      {screen==="doctor_detail" && detailReq && (
        <>
          <Header title="تفاصيل الطلب" onBack={pop} gradient="linear-gradient(160deg,#0F4C75,#1B6CA8)"/>
          <div style={{flex:1,overflowY:"auto",padding:"20px 16px 32px"}} className="fi">
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:56,marginBottom:8}}>👤</div>
              <h3 style={{fontWeight:900,fontSize:18,color:"#0F4C75"}}>{detailReq.patient_name}</h3>
              <p style={{color:"#94A3B8",fontSize:13,marginTop:4}}>{detailReq.patient_age} سنة · {detailReq.patient_phone}</p>
              <div style={{marginTop:12,display:"flex",justifyContent:"center"}}><Badge status={detailReq.status} large/></div>
            </div>
            <div style={{background:"#F8FAFC",borderRadius:16,padding:16,marginBottom:16}}>
              <p style={{fontSize:12,color:"#94A3B8",fontWeight:700,marginBottom:8}}>📝 سبب الزيارة</p>
              <p style={{fontSize:14,color:"#1E293B",lineHeight:1.8}}>{detailReq.reason}</p>
            </div>
            <div style={{display:"flex",gap:12,marginBottom:20}}>
              <div style={{flex:1,background:"#F8FAFC",borderRadius:14,padding:"12px 14px"}}>
                <p style={{fontSize:11,color:"#94A3B8",marginBottom:4}}>تاريخ الطلب</p>
                <p style={{fontSize:13,fontWeight:800,color:"#334155"}}>{fmtDate(detailReq.created_at)}</p>
              </div>
              {detailReq.appointment_time&&(
                <div style={{flex:1,background:"#ECFDF5",borderRadius:14,padding:"12px 14px"}}>
                  <p style={{fontSize:11,color:"#94A3B8",marginBottom:4}}>الموعد المحدد</p>
                  <p style={{fontSize:18,fontWeight:900,color:"#059669"}}>⏰ {detailReq.appointment_time}</p>
                </div>
              )}
            </div>
            {detailReq.status==="pending" && (
              <div style={{background:"#F0F9FF",borderRadius:16,padding:16,border:"1.5px solid #BAE6FD"}}>
                <label style={{...LST,marginBottom:12}}>⏰ حدد وقت الموعد</label>
                <input type="time" value={timeInput} onChange={e=>setTimeInput(e.target.value)}
                  style={{...IST,fontSize:20,fontWeight:800,color:"#0F4C75",textAlign:"center",direction:"ltr",marginBottom:16}}/>
                <div style={{display:"flex",gap:10}}>
                  <Btn onClick={()=>rejectReq(detailReq.id)} style={{flex:1,padding:14,borderRadius:14,border:"2px solid #FCA5A5",background:"#FEF2F2",color:"#DC2626",fontWeight:800,fontSize:14}}>✗ رفض</Btn>
                  <Btn onClick={()=>approveReq(detailReq.id)} disabled={!timeInput}
                    style={{flex:2,padding:14,borderRadius:14,border:"none",background:"linear-gradient(135deg,#0F4C75,#1B6CA8)",color:"#fff",fontWeight:900,fontSize:14,opacity:timeInput?1:.5}}>
                    ✓ تأكيد الموعد
                  </Btn>
                </div>
              </div>
            )}
            {detailReq.status==="approved"&&<div style={{background:"#ECFDF5",borderRadius:14,padding:14,textAlign:"center"}}><p style={{fontSize:14,color:"#059669",fontWeight:700}}>✅ تم قبول هذا الطلب — الساعة {detailReq.appointment_time}</p></div>}
            {detailReq.status==="rejected"&&<div style={{background:"#FEF2F2",borderRadius:14,padding:14,textAlign:"center"}}><p style={{fontSize:14,color:"#DC2626",fontWeight:700}}>❌ تم رفض هذا الطلب</p></div>}
          </div>
        </>
      )}
    </Shell>
  );
}

/* ─── shared components ──────────────────────────────────────────────────────── */
function Shell({ children }) {
  return (
    <div style={{fontFamily:"'Cairo',sans-serif",direction:"rtl",minHeight:"100vh",background:"#F1F5F9",display:"flex",justifyContent:"center"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:0}
        .fi{animation:fi .3s ease}
        @keyframes fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        input:focus,textarea:focus{border-color:#1B6CA8!important;box-shadow:0 0 0 3px rgba(27,108,168,.12);outline:none}
      `}</style>
      <div style={{width:"100%",maxWidth:430,minHeight:"100vh",background:"#fff",boxShadow:"0 0 60px rgba(0,0,0,.1)",display:"flex",flexDirection:"column"}}>
        {children}
      </div>
    </div>
  );
}

function Header({ title, onBack, gradient, backLabel="رجوع" }) {
  return (
    <div style={{background:gradient,padding:"24px 20px 20px",flexShrink:0}}>
      <button onClick={onBack} style={{background:"rgba(255,255,255,.18)",border:"none",borderRadius:12,padding:"7px 14px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Cairo,sans-serif",display:"inline-flex",alignItems:"center",gap:6}}>
        ← {backLabel}
      </button>
      <h2 style={{color:"#fff",fontSize:18,fontWeight:900,marginTop:12}}>{title}</h2>
    </div>
  );
}

function LandingCard({ icon, color, title, sub, onClick }) {
  return (
    <button onClick={onClick} style={{width:"100%",background:color,border:"none",borderRadius:22,padding:"24px 22px",cursor:"pointer",display:"flex",alignItems:"center",gap:18,textAlign:"right",boxShadow:`0 8px 28px ${color}55`,transition:"transform .15s",fontFamily:"Cairo,sans-serif"}}
      onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
      onMouseLeave={e=>e.currentTarget.style.transform="none"}>
      <div style={{width:58,height:58,borderRadius:18,background:"rgba(255,255,255,.18)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,flexShrink:0}}>{icon}</div>
      <div style={{flex:1,textAlign:"right"}}>
        <p style={{color:"#fff",fontWeight:900,fontSize:18,fontFamily:"Cairo,sans-serif"}}>{title}</p>
        <p style={{color:"rgba(255,255,255,.75)",fontSize:13,marginTop:4,fontFamily:"Cairo,sans-serif"}}>{sub}</p>
      </div>
      <span style={{color:"rgba(255,255,255,.6)",fontSize:20}}>←</span>
    </button>
  );
}

function Btn({ onClick, children, style, disabled }) {
  return <button onClick={disabled?undefined:onClick} style={{cursor:disabled?"not-allowed":"pointer",fontFamily:"Cairo,sans-serif",border:"none",background:"none",...style}}>{children}</button>;
}

function Badge({ status, large }) {
  const s = STATUS[status];
  return <span style={{background:s.bg,color:s.color,borderRadius:20,padding:large?"7px 16px":"4px 10px",fontSize:large?14:11,fontWeight:800,display:"inline-flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>{s.icon} {s.label}</span>;
}

function Spinner() {
  return <div style={{textAlign:"center",padding:"40px 20px",color:"#94A3B8"}}><div style={{fontSize:32,marginBottom:8,animation:"spin 1s linear infinite",display:"inline-block"}}>⏳</div><p style={{fontSize:13}}>جاري التحميل...</p><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style></div>;
}

function Empty() {
  return <div style={{textAlign:"center",padding:"60px 20px",color:"#94A3B8"}}><div style={{fontSize:48,marginBottom:12}}>📭</div><p style={{fontSize:14,fontWeight:600}}>لا توجد طلبات</p></div>;
}

const PB  = {padding:"15px 24px",borderRadius:16,background:"linear-gradient(135deg,#0F4C75,#1B6CA8)",color:"#fff",fontSize:15,fontWeight:900};
const LST = {fontSize:13,fontWeight:700,color:"#374151",marginBottom:8,display:"block"};
const IST = {width:"100%",padding:"13px 16px",borderRadius:14,border:"2px solid #E2E8F0",fontSize:14,color:"#334155",fontFamily:"Cairo,sans-serif",transition:"all .2s",marginBottom:0};
