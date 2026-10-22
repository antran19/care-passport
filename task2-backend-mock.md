# Kế hoạch chi tiết triển khai Task 2 — Backend, Mock Mode & Data Quality

**Mục tiêu:** Hoàn thiện toàn bộ hạ tầng Backend, chế độ Mock độc lập (`NEXT_PUBLIC_MOCK=1`), hệ thống Audit Log minh bạch quyền quản trị, kiểm thử tự động và tài liệu API trước hạn nộp 18:00.

---

## 1. Phân rã công việc (Task Breakdown)

### Task 2.1: Chế độ Mock toàn diện (`NEXT_PUBLIC_MOCK=1` & Stub Fallback)
- [ ] Tạo module `src/lib/mock/mockTide.ts` cung cấp mock users (`patient1`, `gp1`, `physio1`, `admin1`).
- [ ] Giả lập các hàm cốt lõi của Tide SDK:
  - `doEncrypt(items)`: Mã hóa mock (prefix `MOCK_CIPHERTEXT::` + base64).
  - `doDecrypt(items)`: Giải mã mock nếu có quyền, hoặc ném lỗi `TIDE-TIDEJS-NET-THRESHOLD_FAILURE` nếu là `admin1` hoặc không có policy.
  - `secureFetch`: Mock fetch kèm token giả lập và DPoP header giả lập.
- [ ] Cập nhật `src/app/providers.tsx` và `src/lib/auth/tidecloakConfig.ts`:
  - Thêm fallback an toàn khi file `data/tidecloak.json` chưa tồn tại (giúp `tsc --noEmit` và `npm run dev` chạy được ngay trên máy TV2 & TV3).
  - Tích hợp mock role switcher tiện lợi cho việc quay video và test giao diện.

### Task 2.2: Rà soát & Tối ưu Bảo mật API Routes (`src/app/api/`)
- [ ] Rà soát `src/app/api/records/route.ts`:
  - Validate payload đầu vào (kiểm tra `id`, độ dài `ciphertext`, sanitize).
  - Chặn GP truy cập hoặc ghi đè hồ sơ chưa được chia sẻ.
- [ ] Rà soát `src/app/api/policies/route.ts`:
  - Kiểm tra thẩm quyền nghiêm ngặt của `ADMIN_ROLE`.
  - Validate định dạng policy base64 và subject group (`/p1-owner`, `/p1-care-team`).
- [ ] Rà soát `src/app/api/share-requests/route.ts`:
  - Bệnh nhân chỉ được gửi share request cho hồ sơ mình sở hữu (`write` policy).
  - Admin chỉ duyệt các trạng thái hợp lệ (`approved`, `rejected`, `revoked`).
- [ ] Rà soát `src/app/api/admin/raw/route.ts`:
  - Xác thực nghiêm ngặt quyền `tide-realm-admin` (trả về đúng 403 nếu user thường gọi).

### Task 2.3: Hệ thống Audit Log (Nhật ký Cấp quyền Quản trị)
- [ ] Mở rộng `src/lib/care/store.ts`:
  - Định nghĩa interface `AuditEntry` (`id`, `timestamp`, `actor`, `action`, `targetRecord`, `details`).
  - Thêm hàm `audit.log(...)` và `audit.all()`, lưu tại `data/care/audit.json`.
- [ ] Tự động ghi log khi:
  - Bệnh nhân tạo yêu cầu chia sẻ (`SHARE_REQUEST_CREATED`).
  - Admin duyệt/từ chối yêu cầu (`SHARE_REQUEST_APPROVED` / `REJECTED`).
  - Admin thêm hoặc thu hồi policy (`POLICY_ADDED` / `POLICY_REVOKED`).
  - Admin đọc raw ciphertext (`ADMIN_RAW_READ_ATTEMPT`).
- [ ] Tạo endpoint `GET /api/audit-logs` (bảo vệ bởi `ADMIN_ROLE`).
- [ ] Cập nhật trang `/admin` hiển thị bảng Audit Log minh bạch.

### Task 2.4: Mở rộng Dữ liệu mẫu (Seed Data)
- [ ] Cập nhật `src/lib/care/data.ts`:
  - Bổ sung hồ sơ thứ 3 cho `patient1`: `rec-blood-test` ("Xét nghiệm sinh hóa máu").
  - Bổ sung bệnh nhân thứ hai `patient2` với hồ sơ `rec-cardio` ("Hồ sơ tim mạch & Holter ECG").
  - Mở rộng cấu trúc nhóm hỗ trợ multi-patient: `/p2-owner`.

### Task 2.5: Script Kiểm thử Tự động (`scripts/test-api.sh`)
- [ ] Tạo script bash kiểm tra tự động tất cả các API endpoints:
  - Test 1: Bệnh nhân đọc/ghi hồ sơ của mình.
  - Test 2: Bác sĩ GP đọc hồ sơ đã được chia sẻ.
  - Test 3: Bác sĩ Physio bị từ chối khi đọc hồ sơ tổng quát (404/403).
  - Test 4: User thường truy cập `/api/admin/raw` bị chặn (403).
  - Test 5: Admin duyệt share request và kiểm tra Audit Log được sinh ra.

### Task 2.6: Soạn thảo Tài liệu `docs/API.md`
- [ ] Viết tài liệu đặc tả toàn bộ API endpoints, request/response mẫu, mã lỗi, và cơ chế bảo mật JWT + DPoP.

---

## 2. Tiêu chí Nghiệm thu (Verification Checklist)
1. `npx tsc --noEmit` vượt qua 100% không còn lỗi thiếu `data/tidecloak.json`.
2. Bật `NEXT_PUBLIC_MOCK=1 npm run dev` có thể duyệt cả 5 trang mà không cần Docker TideCloak.
3. Trang `/admin-attack` ở chế độ mock ném đúng lỗi `TIDE-TIDEJS-NET-THRESHOLD_FAILURE` và hiển thị cảnh báo đỏ.
4. Chạy `bash scripts/test-api.sh` đạt 100% tests Passed.
5. File `docs/API.md` đầy đủ, chuẩn chỉnh để nộp ban giám khảo.
