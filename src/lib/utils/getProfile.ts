export const getProfile = async () => {
    try {
        const response = await fetch(import.meta.env.VITE_API_URL + '/auth/me');
        if (!response.ok) {
            window.location.href = '/login'; // Redirect to login page if not authenticated
            alert('Anda harus login terlebih dahulu untuk mengakses halaman ini.');
        }
        const data = await response.json();
        return { role: data.role, name: data.name, id: data.id };
    } catch (error) {
        console.error('Error fetching profile:', error);
        alert('Terjadi kesalahan saat mengambil profil. Silakan coba lagi.');
        window.location.href = '/login'; // Redirect to login page if an error occurs
        throw error;
    }
};