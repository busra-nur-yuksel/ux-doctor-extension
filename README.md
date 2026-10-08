# UX Doctor (#0): Kanıta Dayalı Tanı Aracı

Açık olan web sayfalarını deterministik kurallar ve Don Norman'ın 6 tasarım ilkesine dayalı üretken yapay zeka (LLM) katmanıyla analiz eden, kanıta dayalı (DOM eşlemeli) Chrome eklentisi (Manifest V3).

---

# UX Doctor (#0): Kanıta Dayalı Tanı Aracı

> 📺 **Demo ve Doğrulama Videosu:** [YouTube Üzerinden İzleyin]
(https://youtu.be/Ng919ARi_Go?si=EEg1PsR0Vdam8VY2)

Açık olan web sayfalarını deterministik kurallar ve Don Norman'ın 6 tasarım ilkesine dayalı üretken yapay zeka (LLM) katmanıyla analiz eden, kanıta dayalı (DOM eşlemeli) Chrome eklentisi (Manifest V3).

## 1. Mimari Şema

```text
[Açık Web Sayfası (DOM)]
         │
         ├───► [Deterministik Motor (deterministic.js)] ─────────► [WCAG 2.2 AA Kontrolleri (0-100)]
         │                                                                   │
         └───► [DOM Sanitizer & Digest]                                      │
                     │ (Kişisel/Şifre verileri maskelenir)                   │
                     ▼                                                       │
               [LLM Motoru (llm_evaluator.js)]                               │
               (Gemma / Claude / OpenAI API)                                 │
                     │                                                       │
                     ├─► Don Norman 6 İlke Alt Skoru (0-100)                 │
                     └─► DOM Doğrulama (querySelector Hallucination Check)   │
                                 │                                           │
                                 ▼                                           ▼
               ┌─────────────────────────────────────────────────────────────────┐
               │ Ağırlıklı Toplam Skor = (Det * 0.55) + (Norman LLM * 0.45)      │
               └─────────────────────────────────────────────────────────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
[Popup Arayüzü & İnteraktif Vurgulama]          [JSON Rapor Dışa Aktarma]
(Renkli Çerçeve + Floating Badge)               (/reports/*.json)
```

---

## 2. Özellikler ve Bileşenler

- **Deterministik Motor (`scripts/deterministic.js`)**: Doğrulanabilir CSS seçicileri ile WCAG 2.2 AA erişilebilirlik denetimleri.
- **LLM Sezgisel Katmanı (`scripts/llm_evaluator.js`)**: Don Norman'ın 6 ilkesine göre yapay zeka destekli değerlendirme ve alt skor üretimi.
- **Esnek API Yapılandırması**: Custom OpenAI-Compatible (Ollama, LocalAI, Gemma), OpenRouter, OpenAI (GPT-4o), Claude API desteği (Base URL ve Model Adı girilebilir).
- **Halüsinasyon Engelleme Katmanı**: `document.querySelector` ile DOM doğrulaması ve halüsinasyon metriği hesaplama.
- **Ağırlıklandırılmış Skorlama**: %55 Deterministik (WCAG) + %45 LLM (Norman Bilişsel Yük) dengeli değerlendirme.
- **Sayfa İçi İnteraktif Vurgulama**: Hatalı öğeyi sayfada odaklama, kırmızı/turuncu çerçeve ve kayan açıklama rozeti (floating badge).
- **Gizlilik İlkeleri**: Hassas sayfa tespiti (parola/oturum tokeni) ile LLM analizini otomatik kapatma ve veri maskeleme.
- **JSON Rapor Dışa Aktarma**: `scores`, `subScores`, `hallucinationMetrics` ve bulguları içeren standart JSON rapor üretimi.

---

## 3. Kurulum ve Kullanım

### Kurulum Adımları
1. Projeyi klonlayın veya indirin:
   ```bash
   cd ux-doctor-extension
   ```
2. Google Chrome tarayıcısını açın ve `chrome://extensions/` adresine gidin.
3. Sağ üst köşedeki **"Geliştirici modu" (Developer mode)** anahtarını açın.
4. **"Paketlenmemiş öğe yükle" (Load unpacked)** butonuna tıklayın ve `ux-doctor-extension` klasörünü seçin.
5. Eklenti simgesi araç çubuğunuza eklenecektir.

### Yapılandırma ve Çalıştırma
1. Eklenti simgesine tıklayarak Popup arayüzünü açın.
2. **API Key**, **Sağlayıcı (Provider)**, **Base URL** (örn: `http://localhost:11434/v1`) ve **Model Adı** (örn: `gemma4`, `gpt-4o-mini`) bilgilerini girip **"Kaydet"** butonuna tıklayın.
3. Herhangi bir web sayfasında **"Analiz Et"** butonuna basarak taramayı başlatın.
4. Bulgular listesinden **"Sayfada Vurgula"** butonuna basarak ilgili öğeyi ekranda görün.
5. **"JSON Rapor İndir"** butonu ile detaylı raporu kaydedin.

---

## 4. Skorlama Modeli & HCI Gerekçesi

### Ağırlıklandırılmış Skor Formülü

$$\text{Final Score} = (\text{Deterministic Score} \times 0.55) + (\text{LLM Score} \times 0.45)$$

#### Don Norman 6 İlke Alt Skorları & Aritmetik Ortalama
LLM katmanı Don Norman'ın 6 ilkesi için 0-100 arasında alt skorlar (`subScores`) üretir:
- **Visibility (Görünürlük)**
- **Feedback (Geri Bildirim)**
- **Constraints (Kısıtlamalar)**
- **Mapping (Eşleme)**
- **Consistency (Tutarlılık)**
- **Affordance (Algılanabilirlik)**

$$\text{LLM Score} = \left\lfloor \frac{S_{\text{vis}} + S_{\text{feed}} + S_{\text{cons}} + S_{\text{map}} + S_{\text{harm}} + S_{\text{aff}}}{6} + 0.5 \right\rfloor$$

#### HCI Ağırlıklandırma Gerekçesi
- **Deterministik Katman (%55 Ağırlık):** WCAG 2.2 AA standartlarına dayalı erişilebilirlik kuralları nesnel, doğrulanabilir ve yasal zorunluluğu olan kurallardır. Bu nedenle objektif hata denetimi skorun ana gövdesini oluşturur (%55).
- **LLM Sezgisel Katmanı (%45 Ağırlık):** Don Norman'ın bilişsel yük, zihinsel model ve sezgisel UX ilkelerini değerlendirir. Erişilebilirlik kurallarına uygun bir sayfa dahi zayıf görünürlük veya hatalı eşleme nedeniyle kullanıcıyı yorabilir. LLM katmanı bu nitel boyutları ölçer (%45).

---

## 5. Uygulanan WCAG ve Don Norman Kuralları

### WCAG 2.2 Deterministik Kurallar

| Kural | Açıklama | Derece | Kesinti |
|:---|:---|:---|:---|
| **WCAG 3.1.1** | Sayfa Dili (`html[lang]`) | Kritik | -15 Puan |
| **WCAG 1.1.1** | Görsel Alt Metni (`img[alt]`) | Yüksek / Düşük | -10 / -2 Puan |
| **WCAG 1.3.1 / 3.3.2** | Form Etiketleri (Form Labels) | Yüksek | -10 Puan |
| **WCAG 2.5.8** | Dokunmatik Hedef Boyutu ($\ge 24\times 24\text{px}$) | Orta | -5 Puan |
| **WCAG 2.4.4** | Bağlantı Metni (Empty Links) | Yüksek | -10 Puan |
| **WCAG 2.4.2** | Sayfa Başlığı (`title` elementi) | Kritik | -15 Puan |

### Don Norman 6 Tasarım İlkesi

1. **Visibility (Görünürlük):** Kullanıcı mevcut durum ve yapılabilecek eylemleri kolayca görebiliyor mu?
2. **Feedback (Geri Bildirim):** Sistem yapılan eylemler hakkında anında ve net bilgi veriyor mu?
3. **Constraints (Kısıtlamalar):** Hatalı kullanımı önleyecek sınırlandırmalar mevcut mu?
4. **Mapping (Eşleme):** Kontroller ile sonuçları arasındaki ilişki zihinsel modele uygun mu?
5. **Consistency (Tutarlılık):** Benzer elemanlar ve eylemler tutarlı tasarlanmış mı?
6. **Affordance (Algılanabilirlik):** Elemanlar nasıl kullanılacaklarını fiziksel/görsel olarak hissettiriyor mu?

---

## 6. Gizlilik, Güvenlik ve DOM Doğrulama

### Hassas Sayfa Tespiti
- Parola alanı (`input[type="password"]`) içeren veya URL adresinde `login`, `auth`, `session`, `signin`, `password` geçen sayfalarda LLM katmanı otomatik olarak devre dışı bırakılır (`isSensitive = true`).
- Hassas sayfalarda sadece yerel deterministik kural denetimi çalıştırılır.

### DOM Veri Hijyeni (DOM Digest)
- LLM'e ham HTML veya kullanıcı verisi asla gönderilmez.
- Sadece sayfa yapısını temsil eden sınırlı sayıda öğe seçicisi (CSS selectors), buton metni ve etiket özetleri (sanitized digest) iletilir.

### Halüsinasyon Kontrolü
- Yapay zeka modelinin ürettiği tüm seçiciler `document.querySelector(finding.selector)` denetiminden geçirilir.
- DOM'da bulunamayan hayali/halüsinatif seçiciler elenir ve `hallucinationMetrics` olarak raporda arşivlenir.

---

## 7. DOĞRULAMA VE TESTLER (VERIFICATION & TESTING)

### 4.a. Tutarlılık ve Tekrarlanabilirlik Testi (Consistency Benchmark)

- **Metot:** 3 farklı sektörden (E-Ticaret, Kamu, Sağlık) canlı web sayfaları üzerinde, sayfa yenilenmeden ve DOM durumu korunarak ardışık 3'er analiz (toplam 9 bağımsız test) yürütülmüştür.
- **Kabul Kriteri:** Her alan için ölçülen LLM puan sapmasının 10 puanın altında kalması ($\Delta \text{LLM} \le 10$).
- **Parametreler:** Model: `gemma4`, Sıcaklık ($T$): `0.1`, Sabit JSON Schema Zorlaması.

---

#### 1. E-Ticaret Kategorisi (trendyol.com)
Sayfada yer alan promosyon widget'ları, kayan bannerlar ve ürün kartları üzerinde test edilmiştir.

| Çalıştırma | Deterministik (%55) | LLM (%45) | Ağırlıklı Genel Puan | Visibility | Feedback | Constraints | Mapping | Consistency | Affordance |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Test 1** | 66 | 60 | 63 | 60 | 50 | 70 | 60 | 70 | 50 |
| **Test 2** | 66 | 60 | 63 | 60 | 50 | 70 | 60 | 70 | 50 |
| **Test 3** | 66 | 63 | 65 | 60 | 50 | 80 | 70 | 70 | 50 |

- **Deterministik Varyans:** 0 puan (66 sabit)
- **LLM Skor Sapması ($\Delta$):** $63 - 60 = \mathbf{3\text{ puan}}$ (Hedef: $\le 10$) ✓
- **Ortalama Skor:** 63.66 | **Standart Sapma ($SD$):** 1.15 puan

---

#### 2. Kamu Hizmeti Kategorisi (turkiye.gov.tr)
Giriş kapısı ana sayfası, hızlı erişim ikonları ve arama kutusu üzerinde test edilmiştir.

| Çalıştırma | Deterministik (%55) | LLM (%45) | Ağırlıklı Genel Puan | Visibility | Feedback | Constraints | Mapping | Consistency | Affordance |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Test 1** | 68 | 60 | 64 | 40 | 50 | 90 | 60 | 70 | 50 |
| **Test 2** | 68 | 57 | 63 | 40 | 50 | 80 | 60 | 70 | 40 |
| **Test 3** | 68 | 65 | 67 | 60 | 50 | 80 | 70 | 75 | 55 |

- **Deterministik Varyans:** 0 puan (68 sabit)
- **LLM Skor Sapması ($\Delta$):** $65 - 57 = \mathbf{8\text{ puan}}$ (Hedef: $\le 10$) ✓
- **Ortalama Skor:** 64.66 | **Standart Sapma ($SD$):** 2.08 puan

---

#### 3. Sağlık Portalı Kategorisi (mhrs.gov.tr)
Kamuya açık randevu bilgilendirme portalı, duyuru alanları ve video modal bileşenleri üzerinde test edilmiştir.

| Çalıştırma | Deterministik (%55) | LLM (%45) | Ağırlıklı Genel Puan | Visibility | Feedback | Constraints | Mapping | Consistency | Affordance |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Test 1** | 40 | 42 | 41 | 30 | 50 | 50 | 50 | 40 | 30 |
| **Test 2** | 40 | 42 | 41 | 30 | 50 | 50 | 50 | 40 | 30 |
| **Test 3** | 40 | 42 | 41 | 30 | 50 | 50 | 50 | 40 | 30 |

- **Deterministik Varyans:** 0 puan (40 sabit)
- **LLM Skor Sapması ($\Delta$):** $42 - 42 = \mathbf{0\text{ puan}}$ (Hedef: $\le 10$) ✓
- **Ortalama Skor:** 41.00 | **Standart Sapma ($SD$):** 0.00 puan (Tam deterministik kararlılık)

---

#### Genel Kararlılık Değerlendirmesi
1. **Deterministik Motorun Güvenilirliği:** Taranan her üç sitede de 3'er ardışık çalıştırma sonucunda deterministik skorlar birebir aynı kalmıştır (Trendyol: 66, Kamu: 68, MHRS: 40). Bu sonuç, kod tabanlı kural motorunun sıfır hata ve sıfır varyans ile çalıştığını kanıtlamaktadır.
2. **LLM Katmanı Varyans Yönetimi:** En yüksek sapma Kamu sitesinde 8 puan olarak gözlemlenmiş; E-Ticaret sitesinde 3 puan, Sağlık sitesinde ise 0 puan olarak kaydedilmiştir. Hiçbir testte yönergede belirlenen 10 puanlık kritik eşik aşılmamıştır.
3. **Stabilizasyonun Teknik Sebepleri:**
   - Model üretim sıcaklığının `temperature: 0.1` seviyesine çekilmesi,
   - Prompt seviyesinde 6 Norman ilkesi için katı JSON yapısının (`subScores`) dayatılması,
   - Girdi olarak ham DOM yerine filtrelenmiş ve maskelenmiş anlamsal düğümlerin (DOM Digest) verilmesi varyansı minimize etmiştir.

### 4.b. Manuel vs Otomasyon Başarım Matrisi (Manual vs Automated Matrix)
Sağlık, E-Ticaret ve Kamu sektörlerinden web siteleri üzerinde ekran okuyucu (NVDA) ve klavye gezintisi ile elle doğrulama gerçekleştirilmiş ve otomasyon sonuçları karşılaştırılmıştır:

$$\text{Precision} = \frac{TP}{TP + FP} = 92.2\%, \quad \text{Recall} = \frac{TP}{TP + FN} = 92.2\%, \quad F_1\text{-Score} = 92.2\%$$

| Web Sitesi Kategorisi | Manuel / NVDA Tespit (Gerçek) | UX Doctor Tespit (TP) | Yanlış Alarm (FP) | Kaçırılan (FN) | Precision | Recall | F1-Score | Genel Başarım |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Sağlık Portalı (Randevu)** | 9 | 8 | 1 | 1 | 88.8% | 88.8% | 88.8% | **88.8%** |
| **E-Ticaret Sitesi (Ürün/Sepet)** | 14 | 13 | 1 | 1 | 92.8% | 92.8% | 92.8% | **92.8%** |
| **Kamu Hizmet Portalı (Form/Giriş)** | 20 | 19 | 1 | 1 | 95.0% | 95.0% | 95.0% | **95.0%** |
| **Ortalama Benchmark** | **43** | **40** | **3** | **3** | **92.2%** | **92.2%** | **92.2%** | **92.2%** |

### 4.c. Halüsinasyon / DOM Doğrulama Metriği Tablosu

$$\text{Hallucination Rate} = \left( \frac{\text{Hallucinated Count}}{\text{Total Findings}} \right) \times 100\%$$

| Test Senaryosu / Domain | Total Findings | Valid Findings | Hallucinated Count | Hallucination Rate (%) | Durum |
|:---|:---:|:---:|:---:|:---:|:---|
| **E-Ticaret Platformu** | 5 | 4 | 1 | 20.00% | Filtrelendi ✓ |
| **Kamu Hizmetleri Portalı** | 7 | 6 | 1 | 14.29% | Filtrelendi ✓ |
| **Haber Portalı** | 8 | 8 | 0 | 0.00% | Tam İsabet ✓ |
| **Karmaşık SPA (React App)** | 10 | 9 | 1 | 10.00% | Filtrelendi ✓ |
| **Genel Ortalama / Benchmark** | **30** | **27** | **3** | **10.00%** | **Filtrelendi ✓** |

### 4.d. Gerçekçi Kullanım Senaryoları

#### A) "Büyükanne Testi" (Grandmother Test)
- **Senaryo:** 65 yaşında, dijital okuryazarlığı düşük ve hafif görme kaybı bulunan bir kullanıcının hastane portalı üzerinden acil randevu alma simülasyonu.
- **Tespit Edilen Engeller:**
  1. *Visibility (Görünürlük):* Randevu alma butonunun küçük ve düşük kontrastlı olması.
  2. *Affordance (Algılanabilirlik):* Takvim bileşeninin tıklanabilir buton hissi vermemesi.
  3. *Feedback (Geri Bildirim):* Seçim yapıldığında yükleme göstergesi bulunmaması.
- **Sistem Tespiti:** LLM alt skorlarında `visibility: 55`, `affordance: 60`, `feedback: 60` puanları verilerek ilgili sorunlar yüksek öncelikle raporlanmıştır.

#### B) "Gece 3 Acil Durum Testi" (3 AM Emergency Test)
- **Senaryo:** Gece 03:00'te yüksek panik ve bilişsel yük (cognitive load) altında nöbetçi eczane / acil servis arayan bir kullanıcının deneyimi.
- **Tespit Edilen Engeller:**
  1. *Constraints (Kısıtlamalar):* Form girdilerinde sınırlandırma olmaması sebebiyle hatalı veri girişi yapılması.
  2. *Mapping (Eşleme):* "Acil Çağrı" ve "İptal" butonlarının zıt renklerle kafa karıştırıcı yerleşimi.
  3. *Consistency (Tutarlılık):* Mobil ve masaüstü görünümlerde tutarsız navigasyon yapısı.
- **Sistem Tespiti:** `mapping` ilkesi ihlali *Kritik*, `constraints` ihlali *Yüksek* seviyede etiketlenmiş ve genel LLM puanı 50 seviyesine düşürülmüştür.

---

## 8. Bilinen Kısıtlar (Known Limitations)

1. **SPA Render Gecikmeleri**: Single Page Application (React/Vue/Angular) sayfalarında DOM tam yüklenmeden analiz çalıştırılırsa bazı dinamik öğeler kaçırılabilir. Sayfa yüklendikten 1-2 saniye sonra analiz çalıştırılması önerilir.
2. **Dynamic Iframe İçerikleri**: Çapraz alan adı (cross-origin) iframe içeriklerine güvenlik kısıtları nedeniyle erişilemez.
3. **Canvas ve Shadow DOM**: HTML5 Canvas üzerinde çizilen UI bileşenleri ve kapalı Shadow DOM öğeleri seçici ile hedeflenemez.
4. **API Bağlantı İhtiyacı**: LLM özellikleri için geçerli bir API Anahtarı ve internet bağlantısı gereklidir (olmadığı durumda sadece deterministik motor çalışır).

---

## 9. Yapay Zeka Entegrasyonu Üzerine Yansıtma Notu (Reflection Note)

Bu projede üretken yapay zeka (LLM); deterministik kodun yetersiz kaldığı bilişsel yük, affordance ve görsel hiyerarşi gibi insan odaklı tasarım kusurlarını tespit etmek üzere ikinci bir analiz katmanı olarak konumlandırılmıştır. Proje geliştirme sürecinde AI hem kritik bir hızlandırıcı hem de dikkatle denetlenmesi gereken bir yanıltıcı kaynak olmuştur.

### AI'ın Katkı Sağladığı ve Hız Kazandırdığı Alanlar
- **Manifest V3 ve Mimari İskelet:** Chrome Extension Manifest V3 mimarisine uygun servis çalışanı (service worker), içerik betikleri (content scripts) ve popup haberleşme hatlarının (message passing) asenkron yapısının hızlıca ayağa kaldırılmasında AI önemli bir hız avantajı sağladı.
- **Bilişsel Tasarım Yorumlaması:** Don Norman'ın 6 ilkesine (Görünürlük, Geri Bildirim, Kısıtlar, Eşleme, Tutarlılık, Algılanabilirlik) dayalı pedagojik UX eleştirileri üretmede ve kural motorlarının gözden kaçırdığı "metinsiz ikon butonları", "ikincil eylem belirsizliği" gibi semantik tasarım hatalarını insan benzeri bir dille gerekçelendirmede son derece başarılı oldu.

### AI'ın Yanılttığı Noktalar ve Teknik Çözüm Süreci
Geliştirme aşamasında doğrudan model davranışlarından kaynaklanan üç kritik teknik problemle karşılaşıldı:
1. **Context Window Aşımı ve Token Patlaması:** İlk denemelerde tüm sayfanın ham DOM ağacı modele beslendiğinde, modelin 16.384 tokenlık girdi sınırının aşıldığı (`14.385 input tokens`) ve API'nin `BadRequestError (400)` döndüğü görüldü. AI başlangıçta tüm HTML'i parse etmeyi önermişti; bu yanılgı DOM'dan yalnızca kritik buton, form ve başlık elemanlarını çekip metinlerini budayan bir DOM özetleyici (sanitization/digest) katmanı yazılarak aşıldı.
2. **Yanıt Kesilmesi ve Sahte Skorlama (Fallback Bug):** Serbest bırakılan model gereksiz uzun açıklamalar yazarak `max_tokens` sınırına takıldı (`finish_reason: length`). Bu durum JSON çıktısının tırnak veya parantezinin yarıda kesilmesine yol açtı. Kod `JSON.parse` aşamasında sözdizimi hatası fırlatınca `catch` bloğuna düşüp arayüze sahte bir **100 puan** bastı. Hatayı tarayıcı geliştirici konsolundaki ağ yanıtlarını adım adım inceleyerek fark ettim; prompt katmanında bulgu sayısını katı bir şekilde 3-4 adetle sınırlandırarak ve JSON şemasını zorunlu kılarak çözdüm.
3. **Markdown Kod Bloğu Uyuşmazlığı:** Model çıktısının başına ve sonuna eklenen ` ```json ` blokları JavaScript parser'ını çökertiyordu. Regex tabanlı bir temizleme filtresi eklenerek yalnızca en dıştaki `{` ve `}` karakterleri arasının okunması sağlandı.

**Sonuç ve Çıkarım:**
Bu deneyim; bir tanı aracında üretken yapay zekanın "başıboş" bırakılamayacağını, mutlaka kural tabanlı bir deterministik motorun, DOM sanitasyonunun ve `document.querySelector` doğrulama filtresinin arkasına bir "orkestra elemanı" olarak yerleştirilmesi gerektiğini somut olarak göstermiştir.
---

**Sürüm**: 1.0.0  
**Tarih**: Ekim 2026  
**Manifest Sürümü**: Manifest V3
