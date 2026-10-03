const LOCAL_SERVER_ORIGIN = 'http://127.0.0.1:5501';
const isLocalPreview = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);
const API_ORIGIN = isLocalPreview ? LOCAL_SERVER_ORIGIN : location.origin;
const API_URL = `${API_ORIGIN}/api/instagram`;
const IMAGE_API_URL = `${API_ORIGIN}/api/instagram-image`;

        const INSTAGRAM_ACCOUNT = 'tamanmadyajetisyogya1956';
        const INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/tamanmadyajetisyogya1956?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw==';
        const FALLBACK_EMPTY = [];

        let instagramPostsData = [];
        let activeFilter = 'all';

        function normalizeCategory(text = '') {
            const lower = text.toLowerCase();
            if (lower.includes('ppdb') || lower.includes('pmb') || lower.includes('pendaftaran')) return 'ppdb';
            if (lower.includes('prestasi') || lower.includes('juara') || lower.includes('meraih') || lower.includes('penghargaan')) return 'prestasi';
            if (lower.includes('diterima') || lower.includes('lolos seleksi') || lower.includes('tes awal') && lower.includes('mandiri')) return 'prestasi';
            return 'kegiatan';
        }

        function getFallbackPosts() {
            return [];
        }

        function extractPostArray(payload) {
            if (!payload) return [];
            if (Array.isArray(payload)) return payload;

            const possibleKeys = ['data', 'items', 'posts', 'results', 'berita', 'news', 'articles'];
            for (const key of possibleKeys) {
                const value = payload[key];
                if (Array.isArray(value)) return value;
                if (value && typeof value === 'object') {
                    const nested = extractPostArray(value);
                    if (nested.length) return nested;
                }
            }

            return [];
        }

        function normalizePost(raw, index) {
            if (!raw || typeof raw !== 'object') return null;

            const image = raw.image || raw.thumbnail_url || raw.media_url || raw.thumbnail || raw.url_image || raw.image_url || raw.cover || raw.photo || raw.src || (Array.isArray(raw.images) ? raw.images[0] : raw.images) || '';
            const caption = raw.caption || raw.content || raw.description || raw.text || raw.title || '';
            const link = raw.link || raw.permalink || raw.instagram_url || raw.post_url || raw.url || INSTAGRAM_PROFILE_URL;
            const date = raw.date || raw.posted_at || raw.created_at || raw.timestamp || raw.published_at || raw.time || `${index + 1} hari yang lalu`;
            const likes = Number(raw.likes || raw.like_count || raw.likes_count || 0);
            const comments = Number(raw.comments || raw.comment_count || raw.comments_count || 0);
            const category = raw.category || normalizeCategory(caption);

            if (!image && !caption && !link) return null;

            const imageUrl = typeof image === 'string' ? image : (image?.url || image?.src || '');

            return {
                id: raw.id || `${category}-${index}-${Date.now()}`,
                category,
                image: imageUrl ? `${IMAGE_API_URL}?url=${encodeURIComponent(imageUrl)}` : '',
                caption: String(caption || 'Postingan baru dari sekolah.'),
                likes: Number.isFinite(likes) ? likes : 0,
                comments: Number.isFinite(comments) ? comments : 0,
                date: String(date),
                link: String(link)
            };
        }

        function updateAboutInstagramImages(posts) {
            const slots = [
                { link: document.getElementById('about-instagram-link-1'), image: document.getElementById('about-instagram-image-1') },
                { link: document.getElementById('about-instagram-link-2'), image: document.getElementById('about-instagram-image-2') }
            ];

            slots.forEach(slot => {
                slot.image.src = '';
                slot.link.href = '#';
                slot.link.classList.add('hidden');
            });

            posts.filter(post => post.image).slice(0, slots.length).forEach((post, index) => {
                slots[index].image.src = post.image;
                slots[index].link.href = post.link;
                slots[index].link.classList.remove('hidden');
            });
        }

        async function loadInstagramPosts() {
            try {
                if (!API_URL) {
                    throw new Error('Halaman dibuka sebagai file, API Instagram tidak bisa dipanggil.');
                }

                const response = await fetch(`${API_URL}?username=${encodeURIComponent(INSTAGRAM_ACCOUNT)}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    cache: 'no-store'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const payload = await response.json();
                const rawPosts = extractPostArray(payload);
                const normalizedPosts = rawPosts
                    .map((item, index) => normalizePost(item, index))
                    .filter(Boolean);

                if (normalizedPosts.length > 0) {
                    instagramPostsData = normalizedPosts;
                    updateAboutInstagramImages(instagramPostsData);
                    renderInstagramFeed(activeFilter);
                    return;
                }

                throw new Error('Empty response');
            } catch (error) {
                console.warn('API Instagram gagal atau kosong, feed sekolah akan tetap kosong:', error);
                instagramPostsData = getFallbackPosts();
                updateAboutInstagramImages(instagramPostsData);
                renderInstagramFeed(activeFilter);
            }
        }

        function renderInstagramFeed(filter = 'all') {
            activeFilter = filter;
            const container = document.getElementById('instagram-feed-container');
            container.innerHTML = '';

            const filteredData = filter === 'all'
                ? instagramPostsData
                : instagramPostsData.filter(item => item.category === filter);

            if (filteredData.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                        <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-pink-100 text-pink-600 text-2xl mb-4">
                            <i class="fab fa-instagram"></i>
                        </div>
                        <h3 class="text-lg font-bold text-gray-900 mb-2">Feed Instagram saat ini belum dapat diambil secara publik</h3>
                        <p class="text-sm text-gray-600 mb-4">Akun Instagram resmi sekolah tersedia di bawah ini. Silakan buka langsung profilnya untuk melihat postingan terbaru.</p>
                        <a href="${INSTAGRAM_PROFILE_URL}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-pink-600 text-white font-semibold text-sm hover:bg-pink-700 transition">
                            <i class="fab fa-instagram mr-2"></i> Buka Instagram Resmi
                        </a>
                    </div>
                `;
                return;
            }

            filteredData.forEach(post => {
                const card = document.createElement('div');
                card.className = 'rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm hover:shadow-lg transition duration-300 flex flex-col';
                card.innerHTML = `
                    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <div class="flex items-center space-x-3">
                            <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 via-orange-400 to-yellow-300 flex items-center justify-center text-xs font-bold text-white">TM</div>
                            <div>
                                <div class="font-semibold text-sm text-gray-900">@${INSTAGRAM_ACCOUNT}</div>
                                <div class="text-[11px] text-gray-500">${post.date}</div>
                            </div>
                        </div>
                        <a href="${INSTAGRAM_PROFILE_URL}" target="_blank" class="text-gray-400 hover:text-pink-500"><i class="fab fa-instagram"></i></a>
                    </div>

                    <div class="relative overflow-hidden cursor-pointer" onclick="openIgModal('${post.id}')">
                        <img src="${post.image}" alt="Instagram Post" class="w-full h-72 object-cover hover:scale-105 transition duration-500">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 hover:opacity-100 transition duration-300"></div>
                        <div class="absolute bottom-3 right-3 flex items-center space-x-3 bg-black/55 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-full">
                            <span><i class="fas fa-heart mr-1"></i>${post.likes}</span>
                            <span><i class="fas fa-comment mr-1"></i>${post.comments}</span>
                        </div>
                    </div>

                    <div class="p-4">
                        <div class="mb-2 inline-flex rounded-full bg-gray-100 text-[10px] font-bold uppercase tracking-wide text-gray-600 px-2.5 py-1">${post.category}</div>
                        <p class="text-sm text-gray-700 leading-relaxed mb-4 line-clamp-3">${post.caption}</p>
                        <div class="flex items-center justify-between border-t border-gray-100 pt-3">
                            <button onclick="openIgModal('${post.id}')" class="text-tamansiswa-800 text-xs font-bold hover:underline flex items-center">
                                Lihat detail <i class="fas fa-arrow-right ml-1"></i>
                            </button>
                            <a href="${post.link || INSTAGRAM_PROFILE_URL}" target="_blank" class="text-pink-600 text-xs font-semibold hover:text-pink-700">
                                Kunjungi akun
                            </a>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        function openIgModal(id) {
            const post = instagramPostsData.find(item => String(item.id) === String(id));
            if (!post) return;

            document.getElementById('modal-img').src = post.image;
            document.getElementById('modal-caption').innerText = post.caption;
            document.getElementById('modal-date').innerText = post.date + " • Instagram Live Feed";
            document.getElementById('modal-link').href = post.link;

            const modal = document.getElementById('ig-modal');
            modal.classList.remove('hidden');
        }

        document.getElementById('close-modal-btn').addEventListener('click', () => {
            document.getElementById('ig-modal').classList.add('hidden');
        });

        document.getElementById('ig-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('ig-modal')) {
                document.getElementById('ig-modal').classList.add('hidden');
            }
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => {
                    b.classList.remove('bg-tamansiswa-800', 'text-white', 'active');
                    b.classList.add('bg-gray-100', 'text-gray-600');
                });
                e.target.classList.remove('bg-gray-100', 'text-gray-600');
                e.target.classList.add('bg-tamansiswa-800', 'text-white', 'active');

                const filter = e.target.getAttribute('data-filter');
                renderInstagramFeed(filter);
            });
        });

        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');

        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });

        document.getElementById('contact-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const msg = document.getElementById('form-success-msg');
            msg.classList.remove('hidden');
            this.reset();
            setTimeout(() => {
                msg.classList.add('hidden');
            }, 5000);
        });

        document.getElementById('refresh-ig-btn').addEventListener('click', function() {
            const icon = this.querySelector('i');
            icon.classList.add('fa-spin');
            setTimeout(() => {
                loadInstagramPosts();
                icon.classList.remove('fa-spin');
            }, 600);
        });

        window.addEventListener('DOMContentLoaded', () => {
            const container = document.getElementById('instagram-feed-container');

            if (!API_URL) {
                container.innerHTML = `
                    <div class="col-span-full rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                        <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-pink-100 text-pink-600 text-2xl mb-4">
                            <i class="fab fa-instagram"></i>
                        </div>
                        <h3 class="text-lg font-bold text-gray-900 mb-2">Instagram hanya aktif saat halaman dibuka melalui server</h3>
                        <p class="text-sm text-gray-600 mb-4">Buka halaman ini dari server lokal/hosting agar feed Instagram dapat dimuat dengan aman.</p>
                        <a href="${INSTAGRAM_PROFILE_URL}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-pink-600 text-white font-semibold text-sm hover:bg-pink-700 transition">
                            <i class="fab fa-instagram mr-2"></i> Buka Instagram Resmi
                        </a>
                    </div>
                `;
                return;
            }

            container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">Memuat postingan Instagram...</div>';
            loadInstagramPosts();
        });
