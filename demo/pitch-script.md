# ProofVault 路演稿（5 分钟，慢速版）

> 英文部分照着念。中文方括号是你的操作或提醒，不用念。
> 要念的英文约 420 词，慢速（每分钟约 110 词）念完不到 4 分钟；加上演示操作、动画和停顿，正好 5 分钟左右。方括号里要补的收费、预算和分工控制在 3 句以内。
> 「/」表示短停顿，「//」表示长停顿（看一眼评委再继续）。

---

## 0:00 – 0:40　Why：问题

[打开页面前，先看着评委说]

Good morning. / We are [团队名]. //

Imagine a patient tells her doctor: / "I take fifty milligrams of metoprolol." //

An AI scribe is listening. / It writes down: / five hundred milligrams. //

That is ten times the dose. / And nobody notices. / The note goes straight into her permanent health record. //

AI is now writing records in clinics, councils and companies. / It is fast. / But when it is wrong, / the error becomes part of the official record, / and people trust it.

---

## 0:40 – 1:10　How：我们的思路

Information managers already know how to protect records. / Every fact must be traceable to a source. / Every change must be recorded. / A person must approve before anything is archived. //

ProofVault builds that know-how into the AI workflow. / It checks each AI record against a library of known error patterns, / shows the reviewer why it matters, / and only seals the record once a human signs off.

---

## 1:10 – 3:40　What：现场演示

[屏幕切到 ProofVault，左侧选中 Clinical AI Ambient Scribe Note — Patient #4092]

This is a sample AI-written clinical note. / ProofVault has already highlighted the risky parts. / Red is misinformation. / Orange is bias. //

[点红色的 metoprolol 500 mg 那一段]

Here is our dose error. / The audit card explains it in information-management terms: / the record is not reliable, / and it breaks ISO 15489. / It also shows the evidence: / the audio says fifty, / and the pharmacy record says fifty. //

[点审计卡上的 Trace in Provenance Map，全屏动画播放约 6 秒，等它走完]

Now we trace it. / The claim sinks through our pattern library, / layer by layer: / Health, / Internal Medicine, / Cardiology. // It lands on a known pattern: / speech-to-text dosage errors. / Everything unrelated fades away. //

The reviewer does not just see "wrong". / They see what kind of wrong, / and the control to apply.

[按 Esc 退出全屏，点橙色的性别偏见那一段]

This one is quieter, / but just as dangerous. / The AI wrote that her symptoms are probably stress, / "as is common in women of her age". // That is bias, / and it can delay a heart diagnosis.

[点 Apply all AI fixes，再打开 Version Diff]

The reviewer can accept the suggested fixes. / Here is the AI draft / next to the corrected version. / Every change is visible.

[切到 IM Sign-off，勾选 4 项，点 Approve & Seal，弹出封存凭证]

Finally, / the information manager signs off. / The record is sealed with a cryptographic hash / and a full audit trail. // Only now / does it enter the archive.

---

## 3:40 – 4:30　扩展与价值

[打开全屏图谱，点左下角 Change claim → Government → 第一个示例，让动画走完]

The same approach works beyond health. / Here is a council policy draft, / traced to an unsourced statistic. //

[按 Esc 退出]

And if you want to test us, / you can upload a new document on the spot, / and Claude will review it paragraph by paragraph. //

Our first users are hospitals, / councils, / and government agencies / that already have records teams. // [用一句话说收费方式，例如按机构年费订阅] // [用一句话说开发预算，例如未来 6 个月需要多少资金、做什么]

---

## 4:30 – 5:00　收尾

AI will keep writing more of our records. / The question is / who checks them before they become history. //

ProofVault makes information managers / the guardians of AI-generated records. //

I'm [名字], / [队友名字] built [负责的部分], / and [队友名字] led [负责的部分]. //

Thank you. / We are happy to take your questions.

---

## 念之前检查一遍

- 方括号里的团队名、收费方式、预算和分工要先填好，再念几遍。
- 演示前先在电脑上走一遍：选中病人 #4092，并确认这条记录还没封存过（刷新页面就会恢复初始状态）。
- 全屏动画走完再开口讲层级，别抢在动画前面。
- 评委如果要现场上传文件，再拿出测试 PDF；路演 5 分钟内不要主动上传，时间不够。
