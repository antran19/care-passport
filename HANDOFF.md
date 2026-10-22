# Care Passport — Team Handoff (UNLOCKED, RMIT x Tide)

Deadline: 2026-10-22 (today). Status: kiến trúc đã chốt, chưa dựng realm hay viết code.

## Mục tiêu
Bệnh nhân chia sẻ/thu hồi hồ sơ cho GP và physio. Có nút "Admin thử đọc" để chứng minh admin bị chặn. Dùng dữ liệu giả. Next.js + TideCloak.

## Kết quả tra cứu từ Tide MCP
1. **Quorum (vd 2/3):** có, nhưng cho thay đổi quản trị (IGA change request), không cho hành động nghiệp vụ tùy ý.
   Ngưỡng mặc định `max(1, floor(0.7 × số tide-realm-admin))`; 3 admin → cần 2. Admin ký bằng enclave Tide.
   Quorum cho hành động tùy ý cần Forseti contract tùy chỉnh, do team Tide deploy (không tự làm được).
2. **Mã hóa theo role + thu hồi:** có, dùng contract có sẵn `RelationshipAttestation:1` (subject User/Group/Role, mỗi item đúng 1 tag = record id).
   Thu hồi: bỏ user khỏi group, gỡ `_tide_decryptor`, hoặc policy có expiry. Sau thu hồi các ORK từ chối giải mã (đo trên test stack cục bộ).
   Không có thu hồi tức thì chắc chắn cho từng hồ sơ + subject User → dùng 1 group riêng cho mỗi hồ sơ + expiry ngắn.
3. **Admin đọc được dữ liệu mã hóa?** Không trực tiếp: server chỉ giữ ciphertext, giải mã cần user đăng nhập + ORK.
   Rủi ro cần nói thẳng: `tide-realm-admin` có thể ký policy cho chính mình → giảm bằng quorum 2/3 và log mọi lần cấp quyền.

## Quyết định
- Cách A (khuyến nghị): bệnh nhân bấm Share → tạo yêu cầu → admin "Care Steward" duyệt trong enclave (quorum 2/3).
  Cách B (bệnh nhân tự chia sẻ) cần contract tùy chỉnh → không kịp hạn.
- Hosting: CHƯA CHỐT (Docker cục bộ hay Skycloak; không chuyển realm sau được).
- Email licence Tide + đồng ý Terms (https://tide.org/legal): CHƯA CÓ — do chủ dự án tự trả lời.

## Kiến trúc tối thiểu
- Realm TideCloak (template pack), IGA bật, 3 tide-realm-admin, role `_tide_encryptor` / `_tide_decryptor`, 1 group/hồ sơ (vd `/patients/p1/care-team`).
- Next.js: `/login` (DPoP), `/patient` (xem, share/revoke), `/gp`, `/physio` (giải mã ở trình duyệt), `/admin-attack` (nút "Admin thử đọc").
- Bảng `records(id, ciphertext)`, `policies(subject, record, bytes, expiry)`.
- Mọi API route xác minh JWT + role + DPoP phía server.
- Dữ liệu giả: 1 bệnh nhân, 2 hồ sơ, 1 GP, 1 physio, 3 admin.

## Thứ tự làm
1. Chốt hosting, email, Terms.
2. `tide_scaffold` (template `nextjs-e2ee-vault`) → bootstrap realm → `tide_doctor` đến `RESULT: OK`.
   Gán `tide-realm-admin` SAU CÙNG (sau đó mọi thay đổi cần người ký).
3. Viết phần riêng của app.
4. Ký policy thật trong enclave, chạy vòng Share → đọc → Revoke → bị từ chối.
5. Quay video 4 cảnh, viết README nêu giới hạn.

## Lưu ý
- Lỗi `TIDE-TIDEJS-NET-THRESHOLD_FAILURE` sau một yêu cầu bị từ chối là lời từ chối của contract, không phải mất mạng. Đừng retry.
- Không commit `.env`, mật khẩu admin master, hay `.claude.json`.
- Không viết lại mã Tide từ trí nhớ; dùng template và tool của Tide MCP.
