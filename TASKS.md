# Care Passport — phân công cập nhật (3 thành viên, deadline hôm nay)

Đọc `HANDOFF.md` trước. Cách chốt: **A** (bệnh nhân bấm Share -> admin ký trong enclave).

## Trạng thái hiện tại (đã có trên `main`)
- Realm TideCloak chạy trên máy TV1, đăng nhập thật, branding GT.
- Backend đã có: `src/lib/care/` (dữ liệu giả + kho lưu), API `/api/policies`, `/api/records`, `/api/share-requests`, `/api/admin/raw`.
- Trang đã có: `/patient`, `/gp`, `/physio`, `/admin`, `/admin-attack` (giao diện cơ bản).
- Helper Tide: `src/lib/tide/relationship.ts`.
- **Chưa kiểm chứng:** lần ký policy đầu tiên trên mạng Tide thật. TV1 đang làm bước này. Nếu mạng Tide chưa có contract `RelationshipAttestation:1`, phương án demo sẽ đổi (TV1 báo trong nhóm).

## Quy tắc chung
- Mỗi người làm trên **nhánh riêng** (`feat/<tên>-<việc>`), mở Pull Request vào `main`, người khác review nhanh rồi merge. Commit nhỏ, push thường xuyên.
- Không commit `.env`, `data/tidecloak.json`, mật khẩu, token, `invite-links.txt`. Đã có trong `.gitignore`.
- Mọi API route mới phải đi qua `withAuth` / `withRole` (`src/lib/auth/middleware.ts`). Không tự viết lại mã Tide, không giải mã ở server.
- Realm chỉ chạy trên máy TV1. TV2 và TV3 **không đăng nhập Tide thật được** từ máy mình. Để làm việc: `npm install`, `npm run dev` chỉ xem được giao diện chưa đăng nhập. Dùng chế độ mock bên dưới.
- Mỗi người tự chạy `npx tsc --noEmit` trước khi mở PR.

## TV1 (chủ máy chạy TideCloak): kiểm chứng thật và phần bảo mật
1. Tạo tài khoản Tide cho `patient1`, `gp1`, `physio1`; thêm `patient1` vào `p1-owner`.
2. Ký policy chủ hồ sơ, rồi chạy vòng: mã hóa -> Share -> GP đọc -> Revoke -> bị từ chối -> admin bị chặn.
3. Sửa lỗi phát sinh trong luồng ký/giải mã. Báo nhóm nếu contract không có trên mạng.
4. (Nếu còn giờ) tạo `admin2`, `admin3` để quorum 2/3. Nếu không: ghi rõ giới hạn trong README.
5. Chạy `tide_doctor` đến `RESULT: OK` trước khi nộp.

## TV2: chất lượng backend, kiểm thử và dữ liệu
1. **Chế độ mock** (`NEXT_PUBLIC_MOCK=1`): trả dữ liệu giả cho các trang mà không cần Tide, để TV3 làm giao diện mà không phải đợi realm. Đặt mock ở `src/lib/mock/`, không đụng `src/lib/auth/`.
2. Rà soát và củng cố API trong `src/app/api/`: kiểm tra đầu vào, mã lỗi đúng (400/401/403/404), không lộ dữ liệu của người khác. Viết các ca kiểm thử bằng `curl` hoặc script trong `scripts/` (ví dụ: GP không lấy được hồ sơ chưa chia sẻ, user thường gọi `/api/admin/raw` nhận 403).
3. Thêm nhật ký cấp quyền: mỗi lần ký, duyệt, thu hồi ghi một dòng (ai, khi nào, hồ sơ nào) vào kho và hiển thị ở trang `/admin`. Đây là cách giảm rủi ro "admin tự cấp quyền cho mình".
4. Mở rộng dữ liệu giả: thêm hồ sơ thứ 3 và một bệnh nhân thứ hai (`patient2`) chỉ để minh họa, không cần tài khoản thật.
5. Viết `docs/API.md`: danh sách API, quyền cần, ví dụ request/response.

## TV3: giao diện, README, video và hồ sơ nộp bài
1. Hoàn thiện giao diện 5 trang (`/patient`, `/gp`, `/physio`, `/admin`, `/admin-attack`): bố cục rõ ràng, trạng thái tải, thông báo lỗi dễ hiểu, màu teal + logo GT trong `branding/`. Khi bị từ chối phải hiện "Bạn không có quyền xem hồ sơ này", không hiện lỗi kỹ thuật thô.
2. Trang `/` hiển thị đúng 3 vai trò (bệnh nhân, bác sĩ, admin) và hướng dẫn demo ngắn.
3. **README.md** (thay README của template): giới thiệu, kiến trúc (vẽ sơ đồ luồng Share/Revoke/Admin bị chặn), cách chạy, và mục **Giới hạn thật**:
   - Thu hồi từng hồ sơ không tức thì (policy hết hạn sau 24 giờ; rút người khỏi nhóm có hiệu lực sau khi họ đăng nhập lại).
   - Admin có thể tự ký quyền cho mình nếu realm chỉ có một admin; quorum 2/3 cần ít nhất 3 admin.
   - Dữ liệu là dữ liệu giả.
4. Kịch bản video demo 4 cảnh (Share -> đọc -> Revoke bị chặn -> Admin bị chặn), thời lượng dưới 5 phút, rồi quay cùng TV1 trên máy TV1.
5. Kiểm tra yêu cầu nộp bài của UNLOCKED (hình thức nộp, tên file, hạn) và lập checklist ở `docs/SUBMISSION.md`.

## Hợp đồng dữ liệu (đã cài đặt, đừng đổi khi chưa báo nhóm)
- `Record`: `id` (cũng là tag mã hóa, duy nhất một tag), `title`, `ciphertext`.
- `StoredPolicy`: `subjectType: "Group"`, `subjectId` (`/p1-owner` hoặc `/p1-care-team`), `recordId`, `access`, `policy` (base64).
- `ShareRequest`: `recordId`, `to: "gp" | "physio" | "care-team"`, `status: "pending" | "approved" | "rejected" | "revoked"`.
- Nhóm: `/p1-owner` (bệnh nhân, đọc và ghi), `/p1-care-team` (GP và physio, chỉ đọc).

## Mốc thời gian gợi ý
- +30 phút: mỗi người clone repo, tạo nhánh, chạy `npm install` và `npx tsc --noEmit`.
- +1,5 giờ: TV2 xong chế độ mock; TV3 xong khung giao diện; TV1 báo kết quả lần ký đầu tiên.
- +3 giờ: ghép, chạy cả vòng trên máy TV1.
- +4 giờ: README, video, kiểm tra cuối.
- +5 giờ: nộp bài.
