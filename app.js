const { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } = React;

/* ============================== 유틸 ============================== */

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getDatesForWeekday(year, month, weekday) {
  const total = daysInMonth(year, month);
  const dates = [];
  for (let d = 1; d <= total; d++) {
    const dt = new Date(year, month - 1, d);
    if (dt.getDay() === weekday) {
      dates.push(`${year}-${pad2(month)}-${pad2(d)}`);
    }
  }
  return dates;
}

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${m}/${d}(${WEEKDAY_NAMES[dow]})`;
}

function monthId(year, month) {
  return `${year}-${pad2(month)}`;
}

/* ============================== 작은 UI 조각들 ============================== */

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="legend">
      <span><span className="dot homeroom"></span>담임 선생님 입력 영역</span>
      <span><span className="dot clinic"></span>클리닉 담당 선생님 입력 영역</span>
    </div>
  );
}

/* ============================== 홈 화면 ============================== */

function Home({ onOpenMonth, onCreate }) {
  const [months, setMonths] = useState(null);

  useEffect(() => {
    const unsub = db
      .collection("clinicMonths")
      .onSnapshot((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.year - a.year) || (b.month - a.month));
        setMonths(list);
      });
    return () => unsub();
  }, []);

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!window.confirm(`${id} 클리닉 방을 삭제할까요? 안의 모든 데이터가 사라지며 되돌릴 수 없어요.`)) return;
    const sessionsSnap = await db.collection("clinicMonths").doc(id).collection("sessions").get();
    const batch = db.batch();
    sessionsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.collection("clinicMonths").doc(id));
    await batch.commit();
  }

  return (
    <div>
      <div className="home-toolbar">
        <h2>클리닉 방 목록</h2>
        <button className="btn btn-primary" onClick={onCreate}>+ 새 클리닉 방 만들기</button>
      </div>

      {months === null && <div className="loading-line">불러오는 중…</div>}

      {months && months.length === 0 && (
        <div className="empty-state">
          <h3>아직 만들어진 클리닉 방이 없어요</h3>
          <p>월을 선택하고 요일별 반 구성을 입력하면 그 달의 클리닉 명단이 자동으로 만들어져요.</p>
          <button className="btn btn-primary" onClick={onCreate}>첫 클리닉 방 만들기</button>
        </div>
      )}

      {months && months.length > 0 && (
        <div className="month-grid">
          {months.map((m) => {
            const days = Array.from(new Set((m.weekdayGroups || []).map((g) => g.dayOfWeek))).sort();
            return (
              <div className="month-card" key={m.id} onClick={() => onOpenMonth(m.id)}>
                <div className="yy">{m.year}</div>
                <div className="mm">{m.month}<span>월 클리닉</span></div>
                <div className="chip-row">
                  {days.map((d) => (
                    <span key={d} className={`chip day-${d}`}>{WEEKDAY_NAMES[d]}요일</span>
                  ))}
                  {days.length === 0 && <span className="chip">요일 미설정</span>}
                </div>
                <div className="card-foot">
                  <span className="open-hint">열어보기 →</span>
                  <button className="btn btn-sm btn-danger-text" onClick={(e) => handleDelete(e, m.id)}>삭제</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================== 클리닉 방 만들기 ============================== */

function CreateRoom({ onDone, onCancel }) {
  const now = new Date();
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1); // 다음 달 기본값 (연도 넘어감도 처리)
  const [year, setYear] = useState(nextMonthDate.getFullYear());
  const [month, setMonth] = useState(nextMonthDate.getMonth() + 1);
  const [selectedDays, setSelectedDays] = useState({ 0: true, 3: true, 6: true }); // 일/수/토 기본
  const [groupsByDay, setGroupsByDay] = useState({
    0: [{ id: uid(), grade: "", time: "", teacher: "" }],
    3: [{ id: uid(), grade: "", time: "", teacher: "" }],
    6: [{ id: uid(), grade: "", time: "", teacher: "" }],
  });
  const [existingMonths, setExistingMonths] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    db.collection("clinicMonths")
      .get()
      .then((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.year - a.year) || (b.month - a.month));
        setExistingMonths(list);
      });
  }, []);

  function toggleDay(d) {
    setSelectedDays((prev) => {
      const next = { ...prev, [d]: !prev[d] };
      return next;
    });
    setGroupsByDay((prev) => {
      if (prev[d]) return prev;
      return { ...prev, [d]: [{ id: uid(), grade: "", time: "", teacher: "" }] };
    });
  }

  function updateGroup(day, groupId, field, value) {
    setGroupsByDay((prev) => ({
      ...prev,
      [day]: prev[day].map((g) => (g.id === groupId ? { ...g, [field]: value } : g)),
    }));
  }

  function addGroup(day) {
    setGroupsByDay((prev) => ({
      ...prev,
      [day]: [...(prev[day] || []), { id: uid(), grade: "", time: "", teacher: "" }],
    }));
  }

  function removeGroup(day, groupId) {
    setGroupsByDay((prev) => ({
      ...prev,
      [day]: prev[day].filter((g) => g.id !== groupId),
    }));
  }

  function loadTemplate() {
    if (!templateId) return;
    const src = existingMonths.find((m) => m.id === templateId);
    if (!src) return;
    const byDay = {};
    const daysOn = {};
    (src.weekdayGroups || []).forEach((g) => {
      daysOn[g.dayOfWeek] = true;
      if (!byDay[g.dayOfWeek]) byDay[g.dayOfWeek] = [];
      byDay[g.dayOfWeek].push({ id: uid(), grade: g.grade || "", time: g.time || "", teacher: g.teacher || "" });
    });
    setSelectedDays((prev) => {
      const next = { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
      Object.keys(daysOn).forEach((d) => (next[d] = true));
      return next;
    });
    setGroupsByDay(byDay);
  }

  const activeDays = Object.keys(selectedDays)
    .map(Number)
    .filter((d) => selectedDays[d])
    .sort();

  async function handleSubmit() {
    setError("");
    const id = monthId(year, month);
    const existing = await db.collection("clinicMonths").doc(id).get();
    if (existing.exists) {
      setError(`${year}년 ${month}월 클리닉 방은 이미 있어요. 목록에서 열어주세요.`);
      return;
    }
    if (activeDays.length === 0) {
      setError("클리닉 요일을 하나 이상 선택해주세요.");
      return;
    }
    setSaving(true);
    try {
      const flatGroups = [];
      activeDays.forEach((day) => {
        (groupsByDay[day] || []).forEach((g, idx) => {
          flatGroups.push({
            id: g.id,
            dayOfWeek: day,
            grade: g.grade,
            time: g.time,
            teacher: g.teacher,
            order: idx,
          });
        });
      });

      await db.collection("clinicMonths").doc(id).set({
        year,
        month,
        weekdayGroups: flatGroups,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      const batch = db.batch();
      const sessionsCol = db.collection("clinicMonths").doc(id).collection("sessions");
      activeDays.forEach((day) => {
        const dates = getDatesForWeekday(year, month, day);
        (groupsByDay[day] || []).forEach((g, idx) => {
          dates.forEach((date) => {
            const ref = sessionsCol.doc();
            batch.set(ref, {
              date,
              dayOfWeek: day,
              groupId: g.id,
              grade: g.grade || "",
              time: g.time || "",
              teacher: g.teacher || "",
              order: idx,
              students: [],
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
          });
        });
      });
      await batch.commit();

      onDone(id);
    } catch (err) {
      console.error(err);
      setError("저장 중 문제가 생겼어요: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="form-card">
      <div className="form-section">
        <div className="label">1. 몇 년 몇 월인가요</div>
        <div className="field-row">
          <div className="field">
            <label>년</label>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>월</label>
            <input type="number" min="1" max="12" value={month} onChange={(e) => setMonth(Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="label">2. 이전 달 포맷 불러오기 (선택)</div>
        <div className="template-row">
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">불러올 달 선택…</option>
            {existingMonths.map((m) => (
              <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>
            ))}
          </select>
          <button className="btn btn-sm" onClick={loadTemplate} disabled={!templateId}>이 포맷 불러오기</button>
          <span className="hint">요일·반·시간·담당자를 그대로 가져와요</span>
        </div>
      </div>

      <div className="form-section">
        <div className="label">3. 클리닉 요일</div>
        <div className="weekday-toggles">
          {WEEKDAY_NAMES.map((name, d) => (
            <button
              key={d}
              className={`weekday-toggle day-${d} ${selectedDays[d] ? "active" : ""}`}
              onClick={() => toggleDay(d)}
              type="button"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="form-section">
        <div className="label">4. 요일별 반 구성 (대상 학년 · 클리닉 시간 · 담당자)</div>
        {activeDays.length === 0 && <div className="hint" style={{ color: "var(--muted)", fontSize: 13 }}>위에서 요일을 먼저 선택해주세요.</div>}
        {activeDays.map((day) => {
          const dates = getDatesForWeekday(year, month, day);
          return (
            <div className="day-config-card" key={day}>
              <div className="day-config-head">
                <span className={`name day-${day}`}>{WEEKDAY_NAMES[day]}요일</span>
                <span className="dates">
                  {dates.length > 0 ? dates.map((d) => formatDateLabel(d)).join(" · ") : "해당 날짜 없음"}
                </span>
              </div>
              {(groupsByDay[day] || []).map((g, idx) => (
                <div className="group-row" key={g.id}>
                  <span className="idx">{idx + 1}</span>
                  <input
                    type="text"
                    placeholder="대상 학년 (예: 초/중등, 고등)"
                    value={g.grade}
                    onChange={(e) => updateGroup(day, g.id, "grade", e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="클리닉 시간 (예: 20:00~22:00)"
                    value={g.time}
                    onChange={(e) => updateGroup(day, g.id, "time", e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="담당자"
                    value={g.teacher}
                    onChange={(e) => updateGroup(day, g.id, "teacher", e.target.value)}
                  />
                  <div className="row-del">
                    <button type="button" onClick={() => removeGroup(day, g.id)} title="이 반 삭제">✕</button>
                  </div>
                </div>
              ))}
              <button className="btn btn-sm add-group-btn" type="button" onClick={() => addGroup(day)}>+ 반 추가</button>
            </div>
          );
        })}
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="form-actions">
        <button className="btn" onClick={onCancel} disabled={saving}>취소</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? "만드는 중…" : "클리닉 방 만들기"}
        </button>
      </div>
    </div>
  );
}

/* ============================== 학생 행 (반, 이름, 담임...) ============================== */

function ExpandingTextarea({ value, placeholder, onChange }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const active = hover || focused;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    } else {
      el.style.height = "";
    }
  }, [active, value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function StudentRow({ index, student, onChange, onDelete }) {
  return (
    <tr>
      <td className="rownum">{index + 1}</td>
      <td className="col-homeroom-cell col-narrow">
        <input type="text" value={student.classRoom || ""} placeholder="정규반"
          onChange={(e) => onChange({ ...student, classRoom: e.target.value })} />
      </td>
      <td className="col-homeroom-cell col-narrow">
        <input type="text" value={student.name || ""} placeholder="이름"
          onChange={(e) => onChange({ ...student, name: e.target.value })} />
      </td>
      <td className="col-homeroom-cell col-narrow">
        <input type="text" value={student.homeroom || ""} placeholder="담임"
          onChange={(e) => onChange({ ...student, homeroom: e.target.value })} />
      </td>
      <td className="col-homeroom-cell col-wide expandable">
        <ExpandingTextarea value={student.task || ""} placeholder="해야할 일"
          onChange={(e) => onChange({ ...student, task: e.target.value })} />
      </td>
      <td className="col-homeroom-cell col-medium expandable">
        <ExpandingTextarea value={student.note || ""} placeholder="특이사항"
          onChange={(e) => onChange({ ...student, note: e.target.value })} />
      </td>
      <td className="col-clinic-cell attend-cell">
        <input type="checkbox" checked={!!student.attended}
          onChange={(e) => onChange({ ...student, attended: e.target.checked })} />
      </td>
      <td className="col-clinic-cell col-wide expandable">
        <ExpandingTextarea value={student.result || ""} placeholder="클리닉 결과"
          onChange={(e) => onChange({ ...student, result: e.target.value })} />
      </td>
      <td className="row-del">
        <button type="button" title="이 학생 삭제" onClick={onDelete}>✕</button>
      </td>
    </tr>
  );
}

/* ============================== 세션(반) 테이블 ============================== */

function SessionTable({ session, onCommit, onDeleteSession }) {
  const [students, setStudents] = useState(session.students || []);
  const [header, setHeader] = useState({ grade: session.grade || "", time: session.time || "", teacher: session.teacher || "" });
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (dirtyRef.current) return;
    setStudents(session.students || []);
    setHeader({ grade: session.grade || "", time: session.time || "", teacher: session.teacher || "" });
  }, [session.students, session.grade, session.time, session.teacher]);

  function markDirty() {
    dirtyRef.current = true;
  }

  function commitStudents(next) {
    setStudents(next);
    markDirty();
    onCommit(session.id, { students: next });
    window.setTimeout(() => { dirtyRef.current = false; }, 1500);
  }

  function commitHeader(next) {
    setHeader(next);
    markDirty();
    onCommit(session.id, next);
    window.setTimeout(() => { dirtyRef.current = false; }, 1500);
  }

  function updateStudent(i, updated) {
    const next = students.map((s, idx) => (idx === i ? updated : s));
    setStudents(next);
    markDirty();
  }

  function commitOnBlur() {
    onCommit(session.id, { students });
    window.setTimeout(() => { dirtyRef.current = false; }, 1500);
  }

  function addStudent() {
    const next = [...students, { id: uid(), classRoom: "", name: "", homeroom: "", task: "", note: "", attended: false, result: "" }];
    commitStudents(next);
  }

  function deleteStudent(i) {
    if (!window.confirm("이 학생 행을 삭제할까요?")) return;
    const next = students.filter((_, idx) => idx !== i);
    commitStudents(next);
  }

  return (
    <div className="session-block">
      <div className="session-head">
        <span className="tag">담당</span>
        <input className="teacher-input" type="text" value={header.teacher}
          onBlur={() => commitHeader(header)}
          onChange={(e) => setHeader((h) => ({ ...h, teacher: e.target.value }))}
          placeholder="담당자" />
        <input className="grade-input" type="text" value={header.grade}
          onBlur={() => commitHeader(header)}
          onChange={(e) => setHeader((h) => ({ ...h, grade: e.target.value }))}
          placeholder="대상 학년" />
        <input className="time-input" type="text" value={header.time}
          onBlur={() => commitHeader(header)}
          onChange={(e) => setHeader((h) => ({ ...h, time: e.target.value }))}
          placeholder="클리닉 시간" />
        <div className="teacher-wrap">
          <span>{students.length}명</span>
          <button className="btn btn-sm btn-danger-text" type="button" onClick={() => onDeleteSession(session.id)}>이 반 삭제</button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="roster">
          <colgroup>
            <col style={{ width: "3%" }} />
            <col style={{ width: "8.4%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "12.8%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "4%" }} />
          </colgroup>
          <thead>
            <tr>
              <th></th>
              <th className="col-homeroom">정규반</th>
              <th className="col-homeroom">이름</th>
              <th className="col-homeroom">담임</th>
              <th className="col-homeroom">해야할 일</th>
              <th className="col-homeroom">특이사항</th>
              <th className="col-clinic">출결</th>
              <th className="col-clinic">클리닉 결과</th>
              <th></th>
            </tr>
          </thead>
          <tbody onBlur={commitOnBlur}>
            {students.map((s, i) => (
              <StudentRow
                key={s.id || i}
                index={i}
                student={s}
                onChange={(updated) => updateStudent(i, updated)}
                onDelete={() => deleteStudent(i)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="session-foot">
        <button className="btn btn-sm" type="button" onClick={addStudent}>+ 학생 추가</button>
      </div>
    </div>
  );
}

/* ============================== 날짜/반 추가 모달 ============================== */

function AddSessionModal({ onClose, onAdd }) {
  const [date, setDate] = useState("");
  const [grade, setGrade] = useState("");
  const [time, setTime] = useState("");
  const [teacher, setTeacher] = useState("");

  return (
    <Modal title="클리닉 날짜/반 추가" onClose={onClose}>
      <div className="field">
        <label>날짜</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="field">
        <label>대상 학년</label>
        <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="예: 초등 5-6" />
      </div>
      <div className="field">
        <label>클리닉 시간</label>
        <input type="text" value={time} onChange={(e) => setTime(e.target.value)} placeholder="예: 19:00~21:00" />
      </div>
      <div className="field">
        <label>담당자</label>
        <input type="text" value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="담당 선생님" />
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>취소</button>
        <button
          className="btn btn-primary"
          disabled={!date}
          onClick={() => date && onAdd({ date, grade, time, teacher })}
        >
          추가하기
        </button>
      </div>
    </Modal>
  );
}

/* ============================== 달력 화면 ============================== */

function buildCalendarWeeks(year, month) {
  const startWeekday = new Date(year, month - 1, 1).getDay();
  const total = daysInMonth(year, month);
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function CalendarGrid({ year, month, byDateMap, onSelectDate }) {
  const weeks = useMemo(() => buildCalendarWeeks(year, month), [year, month]);
  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
  }, []);

  return (
    <div className="calendar-grid">
      <div className="calendar-weekday-row">
        {WEEKDAY_NAMES.map((name, d) => (
          <div key={d} className={`wd day-${d}`}>{name}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div className="calendar-week" key={wi}>
          {week.map((day, di) => {
            if (day === null) return <div className="calendar-cell empty" key={di}></div>;
            const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
            const daySessions = byDateMap[dateStr] || [];
            const hasSessions = daySessions.length > 0;
            const studentCount = daySessions.reduce((sum, s) => sum + (s.students ? s.students.length : 0), 0);
            const isToday = dateStr === todayStr;
            return (
              <div
                key={di}
                className={`calendar-cell day-${di} ${hasSessions ? "has-sessions" : ""} ${isToday ? "is-today" : ""}`}
                onClick={() => hasSessions && onSelectDate(dateStr)}
              >
                <span className="cell-daynum">{day}</span>
                {hasSessions && (
                  <div className="cell-sessions">
                    {daySessions.slice(0, 3).map((s) => (
                      <div className="cell-session-chip" key={s.id}>{s.grade || s.time || "반"}</div>
                    ))}
                    {daySessions.length > 3 && <div className="cell-more">+{daySessions.length - 3}개 더</div>}
                    {studentCount > 0 && <div className="cell-count">{studentCount}명</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ============================== 클리닉 방(월) 화면 ============================== */

function Room({ id, onBack, selectedDate, onSelectDate }) {
  const [monthDoc, setMonthDoc] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const recentEditRef = useRef({});

  useEffect(() => {
    const unsub1 = db.collection("clinicMonths").doc(id).onSnapshot((doc) => {
      setMonthDoc(doc.exists ? { id: doc.id, ...doc.data() } : null);
    });
    const unsub2 = db
      .collection("clinicMonths").doc(id).collection("sessions")
      .onSnapshot((snap) => {
        setSessions((prev) => {
          const prevMap = {};
          (prev || []).forEach((s) => (prevMap[s.id] = s));
          const now = Date.now();
          const list = snap.docs.map((d) => {
            const remoteVal = { id: d.id, ...d.data() };
            const editedAt = recentEditRef.current[d.id];
            if (editedAt && now - editedAt < 1500 && prevMap[d.id]) {
              return prevMap[d.id];
            }
            return remoteVal;
          });
          list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.order || 0) - (b.order || 0)));
          return list;
        });
      });
    return () => { unsub1(); unsub2(); };
  }, [id]);

  const handleCommit = useCallback((sessionId, patch) => {
    recentEditRef.current[sessionId] = Date.now();
    setSessions((prev) => (prev || []).map((s) => (s.id === sessionId ? { ...s, ...patch } : s)));
    db.collection("clinicMonths").doc(id).collection("sessions").doc(sessionId)
      .update({ ...patch, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
      .catch((err) => console.error("저장 실패", err));
  }, [id]);

  async function handleDeleteSession(sessionId) {
    if (!window.confirm("이 반의 명단 전체를 삭제할까요?")) return;
    await db.collection("clinicMonths").doc(id).collection("sessions").doc(sessionId).delete();
  }

  async function handleAddSession({ date, grade, time, teacher }) {
    const dow = new Date(date + "T00:00:00").getDay();
    await db.collection("clinicMonths").doc(id).collection("sessions").add({
      date, dayOfWeek: dow, groupId: null, grade, time, teacher,
      order: 999 + (Date.now() % 1000),
      students: [],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    setShowAdd(false);
    onSelectDate(date);
  }

  const byDate = useMemo(() => {
    const map = {};
    (sessions || []).forEach((s) => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return Object.keys(map).sort().map((date) => ({ date, sessions: map[date] }));
  }, [sessions]);

  const byDateMap = useMemo(() => {
    const map = {};
    byDate.forEach(({ date, sessions: s }) => { map[date] = s; });
    return map;
  }, [byDate]);

  if (monthDoc === null && sessions === null) {
    return <div className="loading-line">불러오는 중…</div>;
  }
  if (monthDoc === null) {
    return <div className="empty-state"><h3>이 클리닉 방을 찾을 수 없어요</h3><button className="btn" onClick={onBack}>목록으로</button></div>;
  }

  const selectedSessions = selectedDate ? (byDateMap[selectedDate] || []) : [];

  return (
    <div>
      <button className="back-link" onClick={onBack}>← 클리닉 방 목록</button>
      <div className="room-head">
        <div>
          <h2>{monthDoc.year}년 {monthDoc.month}월 클리닉</h2>
          <div className="meta">총 {byDate.length}개 날짜 · {(sessions || []).length}개 반</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ 클리닉 날짜/반 추가</button>
      </div>

      <Legend />

      {byDate.length === 0 && (
        <div className="empty-state">
          <h3>아직 등록된 클리닉 날짜가 없어요</h3>
          <p>위의 "클리닉 날짜/반 추가" 버튼으로 날짜와 반을 추가해보세요.</p>
        </div>
      )}

      {byDate.length > 0 && selectedDate === null && (
        <CalendarGrid
          year={monthDoc.year}
          month={monthDoc.month}
          byDateMap={byDateMap}
          onSelectDate={(date) => onSelectDate(date)}
        />
      )}

      {selectedDate !== null && (
        <div>
          <button className="back-link" onClick={() => onSelectDate(null)}>← 달력으로</button>
          <div className="date-block">
            <div className="date-block-head">
              <span className={`date-tab day-${new Date(selectedDate + "T00:00:00").getDay()}`}>
                {formatDateLabel(selectedDate)}
              </span>
            </div>
            {selectedSessions.length === 0 && (
              <div className="empty-state">
                <h3>이 날짜에는 아직 반이 없어요</h3>
                <p>"클리닉 날짜/반 추가" 버튼으로 이 날짜에 반을 추가해보세요.</p>
              </div>
            )}
            {selectedSessions.map((s) => (
              <SessionTable key={s.id} session={s} onCommit={handleCommit} onDeleteSession={handleDeleteSession} />
            ))}
          </div>
        </div>
      )}

      {showAdd && <AddSessionModal onClose={() => setShowAdd(false)} onAdd={handleAddSession} />}
    </div>
  );
}

/* ============================== 앱 루트 ============================== */

function App() {
  const [view, setView] = useState(() => window.history.state || { name: "home" });

  useEffect(() => {
    if (!window.history.state) {
      window.history.replaceState({ name: "home" }, "");
    }
    function onPopState(e) {
      setView(e.state || { name: "home" });
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(next) {
    setView(next);
    window.history.pushState(next, "");
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <div className="brand">
          <span className="brand-mark">CLINIC LEDGER</span>
          <h1>클리닉 명단 관리</h1>
        </div>
        <div className="sub">담임 입력 · 클리닉 담당 입력을 한 화면에서</div>
      </div>

      {view.name === "home" && (
        <Home
          onOpenMonth={(id) => navigate({ name: "room", id, date: null })}
          onCreate={() => navigate({ name: "create" })}
        />
      )}
      {view.name === "create" && (
        <CreateRoom
          onCancel={() => navigate({ name: "home" })}
          onDone={(id) => navigate({ name: "room", id, date: null })}
        />
      )}
      {view.name === "room" && (
        <Room
          id={view.id}
          onBack={() => navigate({ name: "home" })}
          selectedDate={view.date || null}
          onSelectDate={(date) => navigate({ name: "room", id: view.id, date })}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
