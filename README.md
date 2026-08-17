# Ghi chú hàng ngày

Checklist và ghi chú công việc mỗi ngày. Chạy hoàn toàn trong trình duyệt, không
có server, không cần đăng nhập. Dữ liệu là file Markdown nằm trong một repo
GitHub riêng tư của bạn — đọc và sửa được ngay trên github.com.

## Ý tưởng

Hai mã số hoàn toàn tách biệt, cố ý khác hẳn nhau về hình dạng:

| Mã | Ví dụ | Vai trò |
| --- | --- | --- |
| Mã ngày | `WRK_01` | Thứ tự trong danh sách **hôm nay**. Suy từ vị trí, không lưu → tự đánh lại mỗi sáng. |
| Mã việc | `ALP-0042` | **Vĩnh viễn.** Cấp một lần, không bao giờ đổi, kể cả khi việc chuyển dự án. |

Phân cấp bốn tầng:

```
Nhóm      WRK (Công việc) · PER (Cá nhân)
 └ Lĩnh vực   分野A · 分野B · Cuộc sống · Học tập   (thêm/sửa/xoá tuỳ ý)
    └ Dự án     Alpha · Beta · BANK …
       └ Việc      ALP-0042
```

Việc chưa xong **tự động sang ngày mới** với số thứ tự mới, kèm nhãn tuổi
(`+7 ngày`) để bạn thấy ngay việc nào đang tồn đọng.

## Cấu trúc dữ liệu

```
data/
  fields.md                 bảng lĩnh vực
  projects.md               bảng dự án
  contacts.md               danh bạ khách hàng
  recurring.md              quy tắc việc lặp lại
  tasks/ALP.md              "thư mục công việc" của một dự án
  days/2026/2026-08-17.md   ghi chú tự do — chỉ tạo khi có nội dung
```

`data/tasks/ALP.md` mở trên github.com trông như sau — checkbox render sẵn:

```markdown
---
project: ALP
name: Alpha
category: WRK
field: SEK
next: 43
---

## Đang tồn

- [ ] `ALP-0042` Kiểm tra khối lượng tầng 3 `2026.08.10_09.12`

## Đã xong

- [x] `ALP-0041` Gửi bản vẽ revision B `2026.08.09_08.30` → `2026.08.11_16.05`
```

Không có comment ẩn, không có UUID. Sửa tay trên github.com an toàn — dòng nào
app không hiểu thì giữ nguyên chứ không xoá.

## Cài đặt lần đầu

### 1. Tạo repo dữ liệu (riêng tư)

Tạo một repo **private** rỗng, ví dụ `ghi-chu-data`, có ít nhất một file
(README) để nhánh `main` tồn tại. Repo private trên GitHub miễn phí không giới
hạn.

### 2. Tạo token

1. Mở [Fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)
2. **Repository access** → Only select repositories → chọn `ghi-chu-data`
3. **Permissions** → Repository permissions → **Contents** → Read and write
4. Hạn 1 năm

Token chỉ dùng được đúng repo dữ liệu, không đụng được repo nào khác. Mất máy
thì vào GitHub thu hồi.

### 3. Deploy app

Push repo **code** này lên GitHub (public — GitHub Pages bản miễn phí chỉ host
từ repo public; repo này không chứa dữ liệu gì của bạn). Vào
Settings → Pages → Source: **GitHub Actions**. Workflow
[deploy.yml](.github/workflows/deploy.yml) tự build và deploy mỗi lần push lên
`main`.

### 4. Kết nối

Mở app → **Cài đặt** → điền chủ repo, tên repo, token → **Kết nối**.

## Cài lên máy

### iPhone

Safari → nút Chia sẻ → **Thêm vào MH chính**.

> **Bắt buộc làm bước này.** Nếu chỉ mở trong Safari như một web thường, iOS sẽ
> xoá dữ liệu offline sau 7 ngày không dùng. PWA đã cài thì không bị xoá.

### Windows

Edge hoặc Chrome → menu → **Cài đặt ứng dụng này**. App có cửa sổ riêng, icon
riêng trên taskbar, không có thanh địa chỉ.

Chưa hỗ trợ luôn-nổi-trên-cùng — đó là giai đoạn sau, khi bọc bằng Tauri.

## Đồng bộ nặng máy không?

Không. Không có timer nào chạy nền:

- Mọi thao tác ghi vào IndexedDB ngay lập tức, **không chờ mạng**
- Đẩy lên GitHub sau **4 giây** kể từ lúc bạn ngừng gõ, gộp tất cả thay đổi vào
  **một commit**
- Kéo về chỉ khi cửa sổ được focus lại (và bỏ qua nếu vừa kéo dưới 60 giây), hoặc
  khi mạng vừa có lại
- App mở mà không đụng gì → **0 request, 0 CPU**

Một ngày làm việc bình thường khoảng 10–30 request. Giới hạn GitHub là 5000/giờ.

## Khi sửa ở hai máy cùng lúc

Hợp nhất ba chiều dựa trên mã việc vĩnh viễn:

- Thêm việc ở cả hai máy → giữ cả hai
- Một máy đánh dấu xong, máy kia sửa nội dung → **giữ trạng thái xong** (bỏ tick
  lại chỉ mất một chạm, còn mất dấu vết đã làm xong thì không lấy lại được)
- Xoá một bên, sửa bên kia → giữ lại, vì bên kia còn cần
- Ghi chú tự do → giữ **cả hai** bản kèm dấu phân cách để bạn tự chọn

Bộ đếm mã việc luôn nhảy qua số cao nhất mà bất kỳ máy nào đã cấp, nên không bao
giờ có hai việc trùng mã.

## Tìm kiếm

Gõ không dấu vẫn ra: `khoi luong` → "khối lượng". Có khớp gần đúng và khớp tiền
tố, tìm cả trong việc, ghi chú ngày và danh bạ. Không cần nhớ ngày.

## Phát triển

```bash
npm install
npm run dev
```

```bash
npm test
```

Build thử bản production (PowerShell — Git Bash sẽ làm hỏng đường dẫn base):

```bash
npm run build
```

## Giới hạn đã biết

- **Chỉ dùng một mình.** Không có khoá ghi; nếu hai người cùng sửa liên tục thì
  hợp nhất tự động sẽ không đủ.
- **Token nằm trong localStorage** của máy. Chấp nhận được cho máy cá nhân.
- **Ghi chú tự do không hợp nhất tự động** — xung đột thì giữ cả hai bản.
- Việc lặp lại được sinh khi **mở app**, không phải đúng 0h — app tĩnh không có
  tiến trình nền.
