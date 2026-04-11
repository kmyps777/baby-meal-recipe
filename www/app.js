const { useState, useEffect } = React;

// ── 상수 ──────────────────────────────────────
const DEFAULT_STAGES = [
  "초기1단계 (4-5개월)", "초기2단계 (6개월)", "중기1단계 (7개월)",
  "중기2단계 (8개월)", "후기1단계 (9개월)", "후기2단계 (10개월)", "완료기 (11-12개월)"
];
const DEFAULT_CATEGORIES = ["🥦 채소류","🍗 단백질","🌾 곡물","🍎 과일","🐟 생선류","🥣 죽/미음"];

const PASTEL = [
  "bg-rose-100 text-rose-700 border-rose-200","bg-amber-100 text-amber-700 border-amber-200",
  "bg-lime-100 text-lime-700 border-lime-200","bg-sky-100 text-sky-700 border-sky-200",
  "bg-violet-100 text-violet-700 border-violet-200","bg-pink-100 text-pink-700 border-pink-200",
  "bg-teal-100 text-teal-700 border-teal-200","bg-orange-100 text-orange-700 border-orange-200",
];
const STAGE_C = [
  "bg-rose-50 text-rose-500 border-rose-200","bg-amber-50 text-amber-500 border-amber-200",
  "bg-yellow-50 text-yellow-600 border-yellow-200","bg-lime-50 text-lime-600 border-lime-200",
  "bg-emerald-50 text-emerald-600 border-emerald-200","bg-sky-50 text-sky-500 border-sky-200",
  "bg-violet-50 text-violet-500 border-violet-200","bg-pink-50 text-pink-500 border-pink-200",
];
const DOTS = ["bg-rose-400","bg-amber-400","bg-lime-400","bg-sky-400","bg-violet-400","bg-pink-400","bg-teal-400","bg-orange-400"];

const emptyRecipe = (stages) => ({
  id: null, title: "", stage: stages[0] ?? "",
  categories: [], ingredients: [{ name: "", amount: "" }],
  steps: [""], cubeWeight: "", cubeCount: "", memo: "",
});

// ── 공통 모달 ──────────────────────────────────
function Modal({ emoji, title, desc, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 pb-10">
      <div className="bg-white rounded-2xl p-6 mx-4 w-full max-w-sm shadow-xl">
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">{emoji}</div>
          <h3 className="font-bold text-gray-800 text-lg">{title}</h3>
          <p className="text-sm text-gray-400 mt-1" dangerouslySetInnerHTML={{ __html: desc }} />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 font-semibold">취소</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-red-400 text-white font-bold">확인</button>
        </div>
      </div>
    </div>
  );
}

function moveItem(arr, from, to) {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ── 메인 앱 ───────────────────────────────────
function App() {
  const [ready, setReady]     = useState(!!window._firebaseReady);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [page, setPage]       = useState("home");
  const [uid, setUid]         = useState(window._uid || null);

  const [stages, setStages]         = useState(DEFAULT_STAGES);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [recipes, setRecipes]       = useState([]);
  const [recipeOrder, setRecipeOrder] = useState([]);

  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedCat, setSelectedCat]     = useState(null);
  const [sortMode, setSortMode]           = useState(false);
  const [searchQuery, setSearchQuery]     = useState("");

  const [form, setForm]     = useState(() => emptyRecipe(DEFAULT_STAGES));
  const [editId, setEditId] = useState(null);
  const [viewId, setViewId] = useState(null);

  const [delConfirm, setDelConfirm] = useState(null);
  const [delCat, setDelCat]         = useState(null);
  const [delStage, setDelStage]     = useState(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  const [newCat, setNewCat]           = useState("");
  const [editCatIdx, setEditCatIdx]   = useState(null);
  const [editCatVal, setEditCatVal]   = useState("");

  const [newStage, setNewStage]         = useState("");
  const [editStageIdx, setEditStageIdx] = useState(null);
  const [editStageVal, setEditStageVal] = useState("");

  const [emailLinked, setEmailLinked] = useState(false);
  const [linkedEmail, setLinkedEmail] = useState("");
  const [emailInput, setEmailInput]   = useState("");
  const [pwInput, setPwInput]         = useState("");
  const [emailMode, setEmailMode]     = useState("link"); // "link" | "signin"
  const [emailMsg, setEmailMsg]       = useState("");

  const checkEmailLinked = (user) => {
    const provider = user?.providerData?.find(p => p.providerId === "password");
    setEmailLinked(!!provider);
    setLinkedEmail(provider?.email || "");
  };

  // Firebase 준비 대기
  useEffect(() => {
    if (window._firebaseReady) {
      setReady(true); setUid(window._uid);
      checkEmailLinked(window._auth?.currentUser);
      return;
    }
    const h = () => { setReady(true); setUid(window._uid); checkEmailLinked(window._auth?.currentUser); };
    window.addEventListener("firebaseReady", h);
    return () => window.removeEventListener("firebaseReady", h);
  }, []);

  // 인증 상태 변경 감지 (이메일 로그인/연동 시)
  useEffect(() => {
    const h = (e) => {
      const user = e.detail.user;
      setUid(user.uid);
      window._uid = user.uid;
      checkEmailLinked(user);
    };
    window.addEventListener("authChanged", h);
    return () => window.removeEventListener("authChanged", h);
  }, []);

  // 실시간 구독 (uid 기반 — 내 데이터만)
  useEffect(() => {
    if (!ready || !uid) return;
    const { collection, doc, onSnapshot, query, where } = window._firebase;
    const db = window._db;

    // 내 레시피만 구독
    const recipesQ = collection(db, "users", uid, "recipes");
    const unsubR = onSnapshot(recipesQ, snap => {
      setRecipes(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    // 내 설정만 구독
    const unsubS = onSnapshot(doc(db, "settings", uid), snap => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.stages?.length)      setStages(d.stages);
        if (d.categories?.length)  setCategories(d.categories);
        if (d.recipeOrder?.length) setRecipeOrder(d.recipeOrder);
      }
      setLoading(false);
    });

    return () => { unsubR(); unsubS(); };
  }, [ready, uid]);

  // 설정 저장
  const saveSettings = async (s, c, ro) => {
    const { doc, setDoc } = window._firebase;
    const data = { stages: s, categories: c };
    if (ro !== undefined) data.recipeOrder = ro;
    await setDoc(doc(window._db, "settings", uid), data, { merge: true });
  };

  // 색상
  const stageColor = (stage) => { const i = stages.indexOf(stage) % STAGE_C.length; return STAGE_C[i >= 0 ? i : 0]; };
  const catColor   = (cat)   => { const i = categories.indexOf(cat) % PASTEL.length; return PASTEL[i >= 0 ? i : 0]; };

  // 정렬
  const sortedRecipes = (() => {
    const orderMap = {};
    recipeOrder.forEach((id, i) => { orderMap[id] = i; });
    return [...recipes].sort((a, b) => {
      const ai = orderMap[a.id] ?? -1;
      const bi = orderMap[b.id] ?? -1;
      if (ai === -1 && bi === -1) return (b.updatedAt || 0) - (a.updatedAt || 0);
      if (ai === -1) return -1;
      if (bi === -1) return 1;
      return ai - bi;
    });
  })();

  const filtered = sortedRecipes.filter(r => {
    const q = searchQuery.trim().toLowerCase();
    if (selectedStage && r.stage !== selectedStage) return false;
    if (selectedCat && !(r.categories||[]).includes(selectedCat)) return false;
    if (q) {
      const inTitle = r.title?.toLowerCase().includes(q);
      const inIng   = (r.ingredients||[]).some(ing => ing.name?.toLowerCase().includes(q));
      const inMemo  = r.memo?.toLowerCase().includes(q);
      if (!inTitle && !inIng && !inMemo) return false;
    }
    return true;
  });

  const viewRecipe = recipes.find(r => r.id === viewId) ?? null;

  // 레시피 저장
  const saveRecipe = async () => {
    if (!form.title.trim()) { alert("레시피 이름을 입력해주세요!"); return; }
    setSaving(true);
    try {
      const { doc, setDoc } = window._firebase;
      const id = editId || `recipe_${Date.now()}`;
      await setDoc(doc(window._db, "users", uid, "recipes", id), {
        title: form.title, stage: form.stage, categories: form.categories,
        ingredients: form.ingredients, steps: form.steps,
        cubeWeight: form.cubeWeight, cubeCount: form.cubeCount,
        memo: form.memo, updatedAt: Date.now(),
      });
      setForm(emptyRecipe(stages)); setEditId(null); setPage("list");
    } catch(e) { alert("저장 오류 😢\n" + e.message); }
    finally { setSaving(false); }
  };

  // 레시피 삭제
  const doDelete = async () => {
    const id = delConfirm;
    const { doc, deleteDoc } = window._firebase;
    await deleteDoc(doc(window._db, "users", uid, "recipes", id));
    const nextOrder = recipeOrder.filter(oid => oid !== id);
    setRecipeOrder(nextOrder);
    await saveSettings(stages, categories, nextOrder);
    setDelConfirm(null);
    if (viewId === id) { setViewId(null); setPage("list"); }
  };

  // 레시피 순서
  const moveRecipe = async (from, to) => {
    const base = sortedRecipes.map(r => r.id);
    const next = moveItem(base, from, to);
    setRecipeOrder(next);
    await saveSettings(stages, categories, next);
  };

  // 카테고리
  const addCat = async () => {
    if (!newCat.trim()) return;
    const next = [...categories, newCat.trim()]; setCategories(next); setNewCat("");
    await saveSettings(stages, next);
  };
  const doDelCat = async () => {
    const cat = delCat; const next = categories.filter(c => c !== cat);
    setCategories(next); setDelCat(null);
    const { writeBatch, doc } = window._firebase;
    const batch = writeBatch(window._db);
    recipes.forEach(r => {
      if ((r.categories||[]).includes(cat))
        batch.update(doc(window._db,"users",uid,"recipes",r.id), { categories: r.categories.filter(c=>c!==cat) });
    });
    await Promise.all([saveSettings(stages, next), batch.commit()]);
  };
  const saveEditCat = async (idx) => {
    const old = categories[idx]; const nv = editCatVal.trim(); if (!nv) return;
    const next = categories.map((c,i) => i===idx ? nv : c);
    setCategories(next); setEditCatIdx(null); setEditCatVal("");
    const { writeBatch, doc } = window._firebase;
    const batch = writeBatch(window._db);
    recipes.forEach(r => {
      if ((r.categories||[]).includes(old))
        batch.update(doc(window._db,"users",uid,"recipes",r.id), { categories: r.categories.map(c=>c===old?nv:c) });
    });
    await Promise.all([saveSettings(stages, next), batch.commit()]);
  };
  const moveCat = async (from, to) => {
    const next = moveItem(categories, from, to); setCategories(next);
    await saveSettings(stages, next);
  };

  // 단계
  const addStageF = async () => {
    if (!newStage.trim()) return;
    const next = [...stages, newStage.trim()]; setStages(next); setNewStage("");
    await saveSettings(next, categories);
  };
  const doDelStage = async () => {
    const s = delStage; const next = stages.filter(x => x !== s);
    setStages(next); setDelStage(null);
    const { writeBatch, doc } = window._firebase;
    const batch = writeBatch(window._db);
    recipes.forEach(r => { if (r.stage===s) batch.update(doc(window._db,"users",uid,"recipes",r.id), { stage:"" }); });
    await Promise.all([saveSettings(next, categories), batch.commit()]);
  };
  const saveEditStage = async (idx) => {
    const old = stages[idx]; const nv = editStageVal.trim(); if (!nv) return;
    const next = stages.map((s,i) => i===idx ? nv : s);
    setStages(next); setEditStageIdx(null); setEditStageVal("");
    const { writeBatch, doc } = window._firebase;
    const batch = writeBatch(window._db);
    recipes.forEach(r => { if (r.stage===old) batch.update(doc(window._db,"users",uid,"recipes",r.id), { stage:nv }); });
    await Promise.all([saveSettings(next, categories), batch.commit()]);
  };
  const moveStage = async (from, to) => {
    const next = moveItem(stages, from, to); setStages(next);
    await saveSettings(next, categories);
  };

  // 이메일 연동
  const handleLinkEmail = async () => {
    if (!emailInput || !pwInput) { setEmailMsg("이메일과 비밀번호를 입력해주세요."); return; }
    try {
      const { linkWithCredential, EmailAuthProvider } = window._authFns;
      const credential = EmailAuthProvider.credential(emailInput, pwInput);
      await linkWithCredential(window._auth.currentUser, credential);
      setEmailMsg("✅ 연동 완료!");
      setEmailLinked(true);
      setLinkedEmail(emailInput);
      setEmailInput(""); setPwInput("");
    } catch (e) {
      if (e.code === "auth/email-already-in-use") setEmailMsg("이미 사용 중인 이메일이에요.");
      else if (e.code === "auth/weak-password") setEmailMsg("비밀번호는 6자 이상이어야 해요.");
      else if (e.code === "auth/invalid-email") setEmailMsg("올바른 이메일 형식이 아니에요.");
      else setEmailMsg("오류: " + e.message);
    }
  };

  // 이메일로 로그인 (다른 기기)
  const handleSignInEmail = async () => {
    if (!emailInput || !pwInput) { setEmailMsg("이메일과 비밀번호를 입력해주세요."); return; }
    try {
      const { signInWithEmailAndPassword } = window._authFns;
      await signInWithEmailAndPassword(window._auth, emailInput, pwInput);
      setEmailMsg("✅ 로그인 완료!");
      setEmailInput(""); setPwInput("");
    } catch (e) {
      if (e.code === "auth/user-not-found" || e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") setEmailMsg("이메일 또는 비밀번호가 틀렸어요.");
      else setEmailMsg("오류: " + e.message);
    }
  };

  // 이메일 연동 해제
  const handleUnlinkEmail = async () => {
    try {
      const { unlink } = window._authFns;
      await unlink(window._auth.currentUser, "password");
      setEmailLinked(false);
      setLinkedEmail("");
    } catch (e) {
      alert("연동 해제 실패: " + e.message);
    }
  };

  // 계정 삭제 (앱스토어 정책 필수)
  const doDeleteAccount = async () => {
    try {
      const { writeBatch, doc, collection, query, where, getDocs } = window._firebase;
      // 1. 내 모든 레시피 삭제
      const batch = writeBatch(window._db);
      recipes.forEach(r => batch.delete(doc(window._db, "users", uid, "recipes", r.id)));
      // 2. 내 설정 삭제
      batch.delete(doc(window._db, "settings", uid));
      await batch.commit();
      // 3. Firebase Auth 계정 삭제
      await window._auth.currentUser.delete();
      alert("모든 데이터가 삭제되었습니다.");
      window.location.reload();
    } catch(e) {
      alert("삭제 오류 😢\n" + e.message);
    }
    setShowDeleteAccount(false);
  };

  // ════════════════════════════════════════════
  //  로딩
  // ════════════════════════════════════════════
  if (!ready || loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(135deg,#fff5f7,#fef9f0,#f0f9ff)" }}>
      <div className="text-5xl mb-4 spin">🍼</div>
      <p className="text-rose-300 font-medium text-sm">불러오는 중...</p>
    </div>
  );

  // ════════════════════════════════════════════
  //  HOME
  // ════════════════════════════════════════════
  if (page === "home") return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5"
      style={{ background: "linear-gradient(135deg,#fff5f7 0%,#fef9f0 50%,#f0f9ff 100%)" }}>
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">🍼</div>
        <h1 className="text-3xl font-bold text-rose-400 mb-1"
          style={{ fontFamily: "Georgia, serif", letterSpacing: "-0.5px" }}>우리아기 이유식</h1>
        <p className="text-sm text-rose-300 font-medium">나만의 이유식 레시피북 📖</p>
      </div>
      <div className="w-full max-w-sm space-y-3">
        {[
          { icon:"📚", label:"레시피 보기",    sub:`총 ${recipes.length}개의 레시피`,  action:()=>{ setSelectedStage(null); setSelectedCat(null); setSortMode(false); setPage("list"); } },
          { icon:"✏️", label:"새 레시피 추가", sub:"오늘의 이유식을 기록해요",          action:()=>{ setForm(emptyRecipe(stages)); setEditId(null); setPage("add"); } },
          { icon:"🗂️", label:"카테고리 관리", sub:`${categories.length}개 카테고리`,   action:()=>setPage("categories") },
          { icon:"📅", label:"단계 관리",      sub:`${stages.length}개 단계`,           action:()=>setPage("stages") },
          { icon:"⚙️", label:"설정",           sub:"계정 및 데이터 관리",               action:()=>setPage("settings") },
        ].map(item => (
          <button key={item.label} onClick={item.action}
            className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-rose-100 active:scale-95 transition-transform text-left">
            <span className="text-3xl">{item.icon}</span>
            <div>
              <div className="font-bold text-gray-700 text-base">{item.label}</div>
              <div className="text-xs text-gray-400">{item.sub}</div>
            </div>
            <span className="ml-auto text-gray-300 text-lg">›</span>
          </button>
        ))}
      </div>
      <div className="w-full max-w-sm mt-6">
        <p className="text-xs text-gray-400 font-semibold mb-2 px-1">⏱ 단계별 보기</p>
        <div className="flex flex-wrap gap-2">
          {stages.map((s,i) => (
            <button key={s} onClick={()=>{ setSelectedStage(s); setSelectedCat(null); setSortMode(false); setPage("list"); }}
              className={`text-xs rounded-full px-3 py-1 font-semibold border ${STAGE_C[i%STAGE_C.length]}`}>{s}</button>
          ))}
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════
  //  LIST
  // ════════════════════════════════════════════
  if (page === "list") return (
    <div className="min-h-screen" style={{ background: "#fff8f9" }}>
      <div className="sticky top-0 z-10 bg-white border-b border-rose-100 px-4 py-3 flex items-center gap-3">
        <button onClick={()=>{ setSortMode(false); setPage("home"); }} className="text-rose-300 text-xl">←</button>
        <h2 className="font-bold text-gray-700 text-lg flex-1">{sortMode ? "순서 변경 ✏️" : "레시피 목록"}</h2>
        {sortMode ? (
          <button onClick={()=>setSortMode(false)} className="bg-emerald-400 text-white rounded-full px-4 py-1.5 text-sm font-bold">완료</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={()=>setSortMode(true)} className="border border-rose-200 text-rose-400 rounded-full px-3 py-1.5 text-sm font-bold">순서</button>
            <button onClick={()=>{ setForm(emptyRecipe(stages)); setEditId(null); setPage("add"); }} className="bg-rose-400 text-white rounded-full px-4 py-1.5 text-sm font-bold shadow-sm">+ 추가</button>
          </div>
        )}
      </div>

      {!sortMode && (
        <>
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 bg-white border border-rose-200 rounded-xl px-3 py-2.5">
              <span className="text-gray-300 text-base">🔍</span>
              <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                placeholder="레시피 이름, 재료로 검색"
                className="flex-1 text-sm text-gray-700 focus:outline-none bg-transparent" />
              {searchQuery && <button onClick={()=>setSearchQuery("")} className="text-gray-300 text-lg leading-none">×</button>}
            </div>
          </div>
          <div className="px-4 pb-1">
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button onClick={()=>setSelectedStage(null)} className={`flex-shrink-0 text-xs rounded-full px-3 py-1.5 font-semibold border transition-colors ${!selectedStage?"bg-rose-400 text-white border-rose-400":"bg-white text-gray-500 border-gray-200"}`}>전체</button>
              {stages.map((s,i) => (
                <button key={s} onClick={()=>setSelectedStage(s)} className={`flex-shrink-0 text-xs rounded-full px-3 py-1.5 font-semibold border transition-colors ${selectedStage===s?STAGE_C[i%STAGE_C.length]:"bg-white text-gray-500 border-gray-200"}`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="px-4 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button onClick={()=>setSelectedCat(null)} className={`flex-shrink-0 text-xs rounded-full px-3 py-1.5 font-semibold border transition-colors ${!selectedCat?"bg-amber-400 text-white border-amber-400":"bg-white text-gray-500 border-gray-200"}`}>전체</button>
              {categories.map(cat => (
                <button key={cat} onClick={()=>setSelectedCat(cat)} className={`flex-shrink-0 text-xs rounded-full px-3 py-1.5 font-semibold border transition-colors ${selectedCat===cat?"bg-amber-400 text-white border-amber-400":"bg-white text-gray-500 border-gray-200"}`}>{cat}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {sortMode && <p className="text-xs text-gray-400 text-center py-2">↑↓ 버튼으로 순서를 바꿀 수 있어요</p>}

      <div className="px-4 pb-8 space-y-2">
        {(sortMode ? sortedRecipes : filtered).length === 0 ? (
          <div className="text-center py-16 text-gray-300">
            <div className="text-5xl mb-3">{searchQuery ? "🔍" : "🥣"}</div>
            <p className="text-sm">{searchQuery ? `"${searchQuery}" 검색 결과가 없어요` : "레시피가 없어요\n새 레시피를 추가해보세요!"}</p>
          </div>
        ) : (sortMode ? sortedRecipes : filtered).map((recipe, idx, arr) => (
          <div key={recipe.id}
            className={`bg-white rounded-2xl shadow-sm border border-rose-50 px-4 py-3.5 transition-transform ${!sortMode?"cursor-pointer active:scale-98":""}`}
            onClick={()=>{ if (!sortMode) { setViewId(recipe.id); setPage("detail"); } }}>
            <div className="flex items-start gap-2">
              {sortMode && (
                <div className="flex flex-col gap-1 flex-shrink-0 mt-0.5">
                  <button onClick={()=>moveRecipe(idx,idx-1)} disabled={idx===0}
                    className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center font-bold ${idx===0?"text-gray-200 bg-gray-50":"text-rose-400 bg-rose-50 active:bg-rose-100"}`}>↑</button>
                  <button onClick={()=>moveRecipe(idx,idx+1)} disabled={idx===arr.length-1}
                    className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center font-bold ${idx===arr.length-1?"text-gray-200 bg-gray-50":"text-rose-400 bg-rose-50 active:bg-rose-100"}`}>↓</button>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="font-bold text-gray-800 text-base leading-snug flex-1">{recipe.title}</h3>
                  {recipe.stage && <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full border font-semibold ${stageColor(recipe.stage)}`}>{recipe.stage}</span>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(recipe.categories||[]).map(cat => (
                    <span key={cat} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${catColor(cat)}`}>{cat}</span>
                  ))}
                </div>
                {recipe.cubeWeight && recipe.cubeCount && (
                  <p className="text-xs text-gray-400 mt-1.5">🍽️ {recipe.cubeWeight}g × {recipe.cubeCount}개</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ════════════════════════════════════════════
  //  DETAIL
  // ════════════════════════════════════════════
  if (page === "detail" && viewRecipe) return (
    <div className="min-h-screen" style={{ background: "#fff8f9" }}>
      <div className="sticky top-0 z-10 bg-white border-b border-rose-100 px-4 py-3 flex items-center gap-3">
        <button onClick={()=>setPage("list")} className="text-rose-300 text-xl">←</button>
        <h2 className="font-bold text-gray-700 text-lg flex-1 truncate">{viewRecipe.title}</h2>
        <button onClick={()=>{ setForm({...viewRecipe}); setEditId(viewRecipe.id); setPage("add"); }} className="text-sky-400 text-sm font-semibold mr-2">수정</button>
        <button onClick={()=>setDelConfirm(viewRecipe.id)} className="text-red-400 text-sm font-semibold">삭제</button>
      </div>
      <div className="px-4 pt-4 pb-10 space-y-5">
        <div className="flex flex-wrap gap-2 items-center">
          {viewRecipe.stage && <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${stageColor(viewRecipe.stage)}`}>📅 {viewRecipe.stage}</span>}
          {(viewRecipe.categories||[]).map(cat => (
            <span key={cat} className={`text-xs px-3 py-1 rounded-full border font-semibold ${catColor(cat)}`}>{cat}</span>
          ))}
        </div>
        {viewRecipe.cubeWeight && viewRecipe.cubeCount && (
          <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-3xl">🍽️</span>
            <div>
              <p className="text-xs text-sky-400 font-semibold">완성 큐브 양</p>
              <p className="text-xl font-bold text-sky-600">{viewRecipe.cubeWeight}g × {viewRecipe.cubeCount}개</p>
              <p className="text-xs text-sky-400">총 {viewRecipe.cubeWeight * viewRecipe.cubeCount}g</p>
            </div>
          </div>
        )}
        <div className="bg-white rounded-2xl border border-rose-100 p-4">
          <h3 className="font-bold text-gray-700 mb-3">🛒 재료</h3>
          <div className="space-y-2">
            {(viewRecipe.ingredients||[]).map((ing,i) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-dashed border-rose-50 last:border-0">
                <span className="text-gray-700 text-sm font-medium">{ing.name}</span>
                <span className="text-rose-400 text-sm font-bold">{ing.amount}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-amber-100 p-4">
          <h3 className="font-bold text-gray-700 mb-3">👩‍🍳 만드는 순서</h3>
          <div className="space-y-3">
            {(viewRecipe.steps||[]).map((step,i) => (
              <div key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-amber-400 text-white rounded-full text-xs font-bold flex items-center justify-center">{i+1}</span>
                <p className="text-gray-600 text-sm leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
        {viewRecipe.memo && (
          <div className="bg-lime-50 border border-lime-100 rounded-2xl p-4">
            <h3 className="font-bold text-lime-700 mb-2">📝 메모</h3>
            <p className="text-lime-700 text-sm leading-relaxed">{viewRecipe.memo}</p>
          </div>
        )}
      </div>
      {delConfirm === viewRecipe.id && (
        <Modal emoji="🗑️" title="레시피를 삭제할까요?"
          desc={`"${viewRecipe.title}"이(가) 영구 삭제됩니다.`}
          onCancel={()=>setDelConfirm(null)} onConfirm={doDelete} />
      )}
    </div>
  );

  // ════════════════════════════════════════════
  //  ADD / EDIT
  // ════════════════════════════════════════════
  if (page === "add") return (
    <div className="min-h-screen" style={{ background: "#fff8f9" }}>
      <div className="sticky top-0 z-10 bg-white border-b border-rose-100 px-4 py-3 flex items-center gap-3">
        <button onClick={()=>{ setPage("list"); setForm(emptyRecipe(stages)); setEditId(null); }} className="text-rose-300 text-xl">←</button>
        <h2 className="font-bold text-gray-700 text-lg flex-1">{editId ? "레시피 수정" : "새 레시피 ✨"}</h2>
        <button onClick={saveRecipe} disabled={saving}
          className={`rounded-full px-4 py-1.5 text-sm font-bold text-white ${saving?"bg-rose-200":"bg-rose-400"}`}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
      <div className="px-4 pb-20 space-y-5 pt-4">
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">레시피 이름 *</label>
          <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
            placeholder="예: 단호박 미음" maxLength={30}
            className="w-full border border-rose-200 rounded-xl px-4 py-3 text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-rose-200 bg-white" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">📅 단계</label>
          <div className="flex flex-wrap gap-2">
            {stages.map((s,i) => (
              <button key={s} onClick={()=>setForm(p=>({...p,stage:s}))}
                className={`text-xs rounded-full px-3 py-1.5 font-semibold border transition-colors ${form.stage===s?`${STAGE_C[i%STAGE_C.length]} ring-2 ring-offset-1 ring-amber-200`:"bg-white text-gray-500 border-gray-200"}`}>{s}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">🗂️ 카테고리</label>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button key={cat}
                onClick={()=>setForm(p=>({...p,categories:p.categories.includes(cat)?p.categories.filter(c=>c!==cat):[...p.categories,cat]}))}
                className={`text-xs rounded-full px-3 py-1.5 font-semibold border transition-colors ${form.categories.includes(cat)?"bg-violet-400 text-white border-violet-400":"bg-white text-gray-500 border-gray-200"}`}>{cat}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-2 block">🛒 재료</label>
          <div className="space-y-2">
            {form.ingredients.map((ing,i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={ing.name}
                  onChange={e=>setForm(p=>({...p,ingredients:p.ingredients.map((x,idx)=>idx===i?{...x,name:e.target.value}:x)}))}
                  placeholder="재료명" className="flex-1 border border-rose-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-200 bg-white" />
                <input value={ing.amount}
                  onChange={e=>setForm(p=>({...p,ingredients:p.ingredients.map((x,idx)=>idx===i?{...x,amount:e.target.value}:x)}))}
                  placeholder="양" className="w-20 border border-rose-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-200 bg-white" />
                {form.ingredients.length > 1 && (
                  <button onClick={()=>setForm(p=>({...p,ingredients:p.ingredients.filter((_,idx)=>idx!==i)}))}
                    className="text-red-300 text-xl font-bold leading-none">×</button>
                )}
              </div>
            ))}
          </div>
          <button onClick={()=>setForm(p=>({...p,ingredients:[...p.ingredients,{name:"",amount:""}]}))}
            className="mt-2 w-full py-2.5 rounded-xl border-2 border-dashed border-rose-200 text-rose-400 text-sm font-semibold">+ 재료 추가</button>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-2 block">👩‍🍳 만드는 순서</label>
          <div className="space-y-2">
            {form.steps.map((step,i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-amber-400 text-white rounded-full text-xs font-bold flex items-center justify-center mt-2.5">{i+1}</span>
                <textarea value={step}
                  onChange={e=>setForm(p=>({...p,steps:p.steps.map((s,idx)=>idx===i?e.target.value:s)}))}
                  placeholder={`${i+1}번째 순서`} rows={2}
                  className="flex-1 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none bg-white" />
                {form.steps.length > 1 && (
                  <button onClick={()=>setForm(p=>({...p,steps:p.steps.filter((_,idx)=>idx!==i)}))}
                    className="text-red-300 text-xl font-bold mt-2.5 leading-none">×</button>
                )}
              </div>
            ))}
          </div>
          <button onClick={()=>setForm(p=>({...p,steps:[...p.steps,""]}))}
            className="mt-2 w-full py-2.5 rounded-xl border-2 border-dashed border-amber-200 text-amber-400 text-sm font-semibold">+ 순서 추가</button>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-2 block">🍽️ 완성 큐브 양</label>
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <input type="number" value={form.cubeWeight} onChange={e=>setForm(p=>({...p,cubeWeight:e.target.value}))}
                placeholder="무게" className="w-full border border-sky-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-200 bg-white" />
              <p className="text-xs text-gray-400 mt-0.5 text-center">g / 개</p>
            </div>
            <span className="text-gray-400 font-bold">×</span>
            <div className="flex-1">
              <input type="number" value={form.cubeCount} onChange={e=>setForm(p=>({...p,cubeCount:e.target.value}))}
                placeholder="개수" className="w-full border border-sky-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-200 bg-white" />
              <p className="text-xs text-gray-400 mt-0.5 text-center">개</p>
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">📝 메모</label>
          <textarea value={form.memo} onChange={e=>setForm(p=>({...p,memo:e.target.value}))}
            placeholder="아기 반응, 보관 팁 등 자유롭게 기록해요" rows={3}
            className="w-full border border-lime-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-lime-200 resize-none bg-white" />
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════
  //  CATEGORIES
  // ════════════════════════════════════════════
  if (page === "categories") return (
    <div className="min-h-screen" style={{ background: "#fff8f9" }}>
      <div className="sticky top-0 z-10 bg-white border-b border-rose-100 px-4 py-3 flex items-center gap-3">
        <button onClick={()=>setPage("home")} className="text-rose-300 text-xl">←</button>
        <h2 className="font-bold text-gray-700 text-lg flex-1">카테고리 관리 🗂️</h2>
      </div>
      <div className="px-4 pt-5 pb-10 space-y-3">
        <div className="flex gap-2">
          <input value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="새 카테고리 (예: 🥚 달걀)"
            className="flex-1 border border-rose-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-200 bg-white"
            onKeyDown={e=>e.key==="Enter"&&addCat()} />
          <button onClick={addCat} className="bg-rose-400 text-white px-4 py-3 rounded-xl font-bold text-sm">추가</button>
        </div>
        <p className="text-xs text-gray-400 px-1">↑↓ 버튼으로 순서를 바꿀 수 있어요</p>
        <div className="space-y-2">
          {categories.map((cat,i) => (
            <div key={cat} className="flex items-center gap-2 bg-white rounded-2xl border border-gray-100 p-3">
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button onClick={()=>moveCat(i,i-1)} disabled={i===0}
                  className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${i===0?"text-gray-200":"text-gray-400 active:bg-gray-100"}`}>↑</button>
                <button onClick={()=>moveCat(i,i+1)} disabled={i===categories.length-1}
                  className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${i===categories.length-1?"text-gray-200":"text-gray-400 active:bg-gray-100"}`}>↓</button>
              </div>
              {editCatIdx === i ? (
                <>
                  <input value={editCatVal} onChange={e=>setEditCatVal(e.target.value)}
                    className="flex-1 border border-violet-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
                  <button onClick={()=>saveEditCat(i)} className="text-violet-500 font-bold text-sm">저장</button>
                  <button onClick={()=>setEditCatIdx(null)} className="text-gray-400 text-sm">취소</button>
                </>
              ) : (
                <>
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOTS[i%8]}`} />
                  <span className="flex-1 font-semibold text-sm text-gray-700">{cat}</span>
                  <span className="text-xs text-gray-300">{recipes.filter(r=>(r.categories||[]).includes(cat)).length}개</span>
                  <button onClick={()=>{ setEditCatIdx(i); setEditCatVal(cat); }} className="text-sky-400 text-xs font-semibold px-2">수정</button>
                  <button onClick={()=>setDelCat(cat)} className="text-red-300 text-xs font-semibold px-2">삭제</button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      {delCat && (
        <Modal emoji="🗂️" title="카테고리를 삭제할까요?"
          desc={`"${delCat}" 카테고리가 삭제되고<br/>연결된 레시피에서도 제거돼요.`}
          onCancel={()=>setDelCat(null)} onConfirm={doDelCat} />
      )}
    </div>
  );

  // ════════════════════════════════════════════
  //  STAGES
  // ════════════════════════════════════════════
  if (page === "stages") return (
    <div className="min-h-screen" style={{ background: "#fff8f9" }}>
      <div className="sticky top-0 z-10 bg-white border-b border-rose-100 px-4 py-3 flex items-center gap-3">
        <button onClick={()=>setPage("home")} className="text-rose-300 text-xl">←</button>
        <h2 className="font-bold text-gray-700 text-lg flex-1">단계 관리 📅</h2>
      </div>
      <div className="px-4 pt-5 pb-10 space-y-3">
        <div className="flex gap-2">
          <input value={newStage} onChange={e=>setNewStage(e.target.value)} placeholder="새 단계 (예: 🌟 돌 이후)"
            className="flex-1 border border-amber-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-200 bg-white"
            onKeyDown={e=>e.key==="Enter"&&addStageF()} />
          <button onClick={addStageF} className="bg-amber-400 text-white px-4 py-3 rounded-xl font-bold text-sm">추가</button>
        </div>
        <p className="text-xs text-gray-400 px-1">↑↓ 버튼으로 순서를 바꿀 수 있어요 🌱</p>
        <div className="space-y-2">
          {stages.map((stage,i) => {
            const sc = STAGE_C[i%STAGE_C.length];
            return (
              <div key={stage} className={`flex items-center gap-2 bg-white rounded-2xl border p-3 ${sc.split(" ")[2]}`}>
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button onClick={()=>moveStage(i,i-1)} disabled={i===0}
                    className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${i===0?"text-gray-200":"text-gray-400 active:bg-gray-100"}`}>↑</button>
                  <button onClick={()=>moveStage(i,i+1)} disabled={i===stages.length-1}
                    className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${i===stages.length-1?"text-gray-200":"text-gray-400 active:bg-gray-100"}`}>↓</button>
                </div>
                {editStageIdx === i ? (
                  <>
                    <input value={editStageVal} onChange={e=>setEditStageVal(e.target.value)}
                      className="flex-1 border border-amber-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
                    <button onClick={()=>saveEditStage(i)} className="text-amber-500 font-bold text-sm">저장</button>
                    <button onClick={()=>setEditStageIdx(null)} className="text-gray-400 text-sm">취소</button>
                  </>
                ) : (
                  <>
                    <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${sc.split(" ")[0]} ${sc.split(" ")[1]}`}>{i+1}</span>
                    <span className="flex-1 font-semibold text-sm text-gray-700">{stage}</span>
                    <span className="text-xs text-gray-300">{recipes.filter(r=>r.stage===stage).length}개</span>
                    <button onClick={()=>{ setEditStageIdx(i); setEditStageVal(stage); }} className="text-sky-400 text-xs font-semibold px-2">수정</button>
                    <button onClick={()=>setDelStage(stage)} className="text-red-300 text-xs font-semibold px-2">삭제</button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {delStage && (
        <Modal emoji="📅" title="단계를 삭제할까요?"
          desc={`"${delStage}" 단계가 삭제되고<br/>연결된 레시피의 단계 정보가 비워져요.`}
          onCancel={()=>setDelStage(null)} onConfirm={doDelStage} />
      )}
    </div>
  );

  // ════════════════════════════════════════════
  //  SETTINGS (앱스토어 정책 - 계정 삭제 필수)
  // ════════════════════════════════════════════
  if (page === "settings") return (
    <div className="min-h-screen" style={{ background: "#fff8f9" }}>
      <div className="sticky top-0 z-10 bg-white border-b border-rose-100 px-4 py-3 flex items-center gap-3">
        <button onClick={()=>setPage("home")} className="text-rose-300 text-xl">←</button>
        <h2 className="font-bold text-gray-700 text-lg flex-1">설정 ⚙️</h2>
      </div>
      <div className="px-4 pt-5 pb-10 space-y-4">

        {/* 계정 정보 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-bold text-gray-700 mb-3">계정 정보</h3>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-gray-500">로그인 방식</span>
            <span className="text-sm font-semibold text-gray-700">익명 로그인</span>
          </div>
          <div className="flex justify-between items-center py-2 border-t border-gray-50">
            <span className="text-sm text-gray-500">기기 ID</span>
            <span className="text-xs text-gray-400 font-mono">{uid?.slice(0,12)}...</span>
          </div>
          <div className="flex justify-between items-center py-2 border-t border-gray-50">
            <span className="text-sm text-gray-500">저장된 레시피</span>
            <span className="text-sm font-semibold text-rose-400">{recipes.length}개</span>
          </div>
        </div>

        {/* 이메일 연동 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-bold text-gray-700 mb-1">이메일 연동 📧</h3>
          <p className="text-xs text-gray-400 mb-3">연동하면 다른 기기에서도 레시피를 볼 수 있어요.</p>
          {emailLinked ? (
            <div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">연동된 이메일</span>
                <span className="text-sm font-semibold text-emerald-500">{linkedEmail}</span>
              </div>
              <button onClick={handleUnlinkEmail}
                className="mt-3 w-full py-2 rounded-xl bg-gray-50 text-gray-400 font-semibold text-sm border border-gray-100">
                연동 해제
              </button>
            </div>
          ) : (
            <div>
              <div className="flex rounded-xl overflow-hidden border border-gray-100 mb-3">
                <button onClick={()=>{setEmailMode("link");setEmailMsg("");}}
                  className={`flex-1 py-2 text-sm font-semibold ${emailMode==="link" ? "bg-rose-400 text-white" : "bg-gray-50 text-gray-400"}`}>
                  처음 연동
                </button>
                <button onClick={()=>{setEmailMode("signin");setEmailMsg("");}}
                  className={`flex-1 py-2 text-sm font-semibold ${emailMode==="signin" ? "bg-rose-400 text-white" : "bg-gray-50 text-gray-400"}`}>
                  다른 기기 로그인
                </button>
              </div>
              <input type="email" value={emailInput} onChange={e=>setEmailInput(e.target.value)}
                placeholder="이메일" className="w-full px-3 py-2 mb-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-rose-300" />
              <input type="password" value={pwInput} onChange={e=>setPwInput(e.target.value)}
                placeholder="비밀번호 (6자 이상)" className="w-full px-3 py-2 mb-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-rose-300" />
              {emailMsg && <p className={`text-xs mb-2 ${emailMsg.startsWith("✅") ? "text-emerald-500" : "text-red-400"}`}>{emailMsg}</p>}
              <button onClick={emailMode==="link" ? handleLinkEmail : handleSignInEmail}
                className="w-full py-3 rounded-xl bg-rose-400 text-white font-bold text-sm">
                {emailMode==="link" ? "이 기기에 연동하기" : "이메일로 로그인"}
              </button>
            </div>
          )}
        </div>

        {/* 데이터 삭제 (앱스토어 필수) */}
        <div className="bg-white rounded-2xl border border-red-100 p-4">
          <h3 className="font-bold text-gray-700 mb-1">데이터 관리</h3>
          <p className="text-xs text-gray-400 mb-3">계정과 모든 레시피 데이터를 영구 삭제해요.</p>
          <button onClick={()=>setShowDeleteAccount(true)}
            className="w-full py-3 rounded-xl bg-red-50 text-red-400 font-bold text-sm border border-red-100">
            계정 및 데이터 삭제
          </button>
        </div>
      </div>

      {showDeleteAccount && (
        <Modal emoji="⚠️" title="정말 삭제할까요?"
          desc={`모든 레시피(${recipes.length}개)와 설정이<br/>영구적으로 삭제되며 복구할 수 없어요.`}
          onCancel={()=>setShowDeleteAccount(false)} onConfirm={doDeleteAccount} />
      )}
    </div>
  );

  return null;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
