# Care Passport — phân công (3 thành viên, deadline hôm nay)

Đọc `HANDOFF.md` trước. Cách chốt: **A** (bệnh nhân bấm Share -> admin duyệt trong enclave, quorum 2/3).

## Quy tắc chung
- Mỗi người làm trên **nhánh riêng** (`feat/<tên>-<việc>`), mở Pull Request vào `main`, người khác review nhanh rồi merge.
- Không commit `.env`, `data/tidecloak.json`, mật khẩu, token. Đã có trong `.gitignore`.
- Mọi API route phải đi qua `withAuth` / `withRole` của template (`src/lib/auth/middleware.ts`). Không tự viết lại mã Tide.
- Ba người chốt giao diện hai bên (API + kiểu dữ liệu) ở mục "Hợp đồng" dưới đây trước khi code.

## Lưu ý về TideCloak
Realm đang chạy bằng Docker trên máy của **Thành viên 1**. Hai người còn lại không vào được `localhost:8080` của máy đó.
- Thành viên 2 và 3 có thể làm giao diện / API với **dữ liệu mock** (không cần đăng nhập Tide thật) rồi ghép sau.
- Nếu muốn tự chạy realm riêng: `npm run init` trên máy mình. Khi đó **mỗi người phải tự dùng email của mình và tự đồng ý Terms của Tide** (https://tide.org/legal). Không dùng email hay đồng ý thay người khác.

## Thành viên 1 — Realm, bảo mật, quorum (người giữ máy chạy TideCloak)
1. Tạo thêm 2 admin Tide (cần 3 admin để quorum 2/3). Mỗi admin tự tạo tài khoản qua link mời.
2. Gán role `_tide_encryptor` / `_tide_decryptor` cho GP, physio, bệnh nhân demo; tạo group `/patients/p1/care-team`.
3. Ký policy `RelationshipAttestation:1` trong enclave (Group subject), chạy được vòng Share -> đọc -> Revoke -> bị từ chối.
4. Làm API xác minh JWT + DPoP + role cho mọi route; viết endpoint "admin thử đọc" (trả về lỗi bị chặn + ciphertext).
5. Chạy `tide_doctor` đến `RESULT: OK` trước khi nộp.

## Thành viên 2 — Dữ liệu và luồng mã hóa/chia sẻ (backend + client crypto)
1. Dữ liệu giả: 1 bệnh nhân, 2 hồ sơ, 1 GP, 1 physio (`src/data/seed.ts`).
2. Bảng `records(id, ciphertext)` và `policies(subject, record, bytes, expiry)` (SQLite hoặc JSON).
3. API: `POST /api/share-requests`, `GET /api/policies/:record`, `POST /api/revoke`, `GET/POST /api/records`.
4. Hàm client `encryptForRecord` / `decryptForRecord` (mỗi item đúng **một** tag = record id; xem `.tide-pack/templates/relationship-attestation`, tải bằng lệnh trong `HANDOFF.md`).
5. Xử lý lỗi `TIDE-TIDEJS-NET-THRESHOLD_FAILURE` như lời từ chối của contract: hiện "không có quyền", không retry.

## Thành viên 3 — Giao diện, demo và hồ sơ nộp bài
1. Trang `/patient` (hồ sơ, nút Share / Revoke), `/gp`, `/physio`, `/admin-attack` (nút "Admin thử đọc" hiện trạng thái BỊ CHẶN).
2. Giao diện nhất quán (logo GT, màu teal đã có trong `branding/`). Làm với mock trước, ghép API của TV2 sau.
3. README: kiến trúc, cách chạy, **giới hạn thật** (thu hồi không tức thì cho từng hồ sơ; admin có thể tự ký quyền cho mình nếu không có quorum).
4. Quay video demo 4 cảnh: Share -> đọc -> Revoke bị chặn -> Admin bị chặn. Kiểm tra lại yêu cầu nộp bài của UNLOCKED.

## Hợp đồng giữa các phần (chốt sớm)
- `Record { id, patientId, title, ciphertext }`
- `Policy { id, recordId, subjectType: "Group", subjectId, roles, expiry, bytes }`
- `ShareRequest { id, recordId, requestedFor: "gp" | "physio", status: "pending" | "approved" | "rejected" }`

## Mốc thời gian gợi ý
- +1h: nhánh, dữ liệu giả, mock UI chạy được.
- +3h: luồng Share/đọc thật với policy đã ký.
- +4h: Revoke + "admin thử đọc" chạy đúng.
- +5h: README, video, kiểm tra cuối, nộp.
