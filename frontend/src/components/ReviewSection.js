import React, { useState, useEffect } from 'react';
import { Star, Send, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

const labels = {
  nl: {
    title: 'Wat dealers zeggen',
    write: 'Schrijf een review',
    placeholder: 'Deel uw ervaring met Moto Import...',
    anonymous: 'Anoniem plaatsen',
    submit: 'Plaatsen',
    login_required: 'Log in als dealer om een review te plaatsen',
    success: 'Review geplaatst!',
    already: 'U heeft al een review geplaatst',
    min_chars: 'Minimaal 10 tekens',
    no_reviews: 'Nog geen reviews. Wees de eerste!',
  },
  it: {
    title: 'Cosa dicono i concessionari',
    write: 'Scrivi una recensione',
    placeholder: 'Condividi la tua esperienza con Moto Import...',
    anonymous: 'Pubblica anonimamente',
    submit: 'Pubblica',
    login_required: 'Accedi come concessionario per scrivere una recensione',
    success: 'Recensione pubblicata!',
    already: 'Hai gi\u00e0 pubblicato una recensione',
    min_chars: 'Minimo 10 caratteri',
    no_reviews: 'Nessuna recensione ancora. Sii il primo!',
  },
  de: {
    title: 'Was H\u00e4ndler sagen',
    write: 'Bewertung schreiben',
    placeholder: 'Teilen Sie Ihre Erfahrung mit Moto Import...',
    anonymous: 'Anonym ver\u00f6ffentlichen',
    submit: 'Ver\u00f6ffentlichen',
    login_required: 'Melden Sie sich als H\u00e4ndler an, um eine Bewertung zu schreiben',
    success: 'Bewertung ver\u00f6ffentlicht!',
    already: 'Sie haben bereits eine Bewertung abgegeben',
    min_chars: 'Mindestens 10 Zeichen',
    no_reviews: 'Noch keine Bewertungen. Seien Sie der Erste!',
  },
  fr: {
    title: 'Ce que disent les concessionnaires',
    write: '\u00c9crire un avis',
    placeholder: 'Partagez votre exp\u00e9rience avec Moto Import...',
    anonymous: 'Publier anonymement',
    submit: 'Publier',
    login_required: 'Connectez-vous en tant que concessionnaire pour \u00e9crire un avis',
    success: 'Avis publi\u00e9!',
    already: 'Vous avez d\u00e9j\u00e0 publi\u00e9 un avis',
    min_chars: 'Minimum 10 caract\u00e8res',
    no_reviews: "Pas encore d'avis. Soyez le premier!",
  },
};

function StarRating({ rating, onRate, interactive = false, size = 'w-5 h-5' }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size} transition-colors ${
            star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-600'
          } ${interactive ? 'cursor-pointer hover:text-yellow-300' : ''}`}
          onClick={() => interactive && onRate(star)}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }) {
  const date = new Date(review.created_at);
  const timeAgo = getTimeAgo(date);

  return (
    <div className="bg-zinc-900/80 border border-zinc-800/60 rounded-2xl p-6 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-zinc-500" />
          </div>
          <span className="text-sm font-medium text-zinc-300 truncate">
            {review.dealer_company}
          </span>
        </div>
        <span className="text-xs text-zinc-600 flex-shrink-0">{timeAgo}</span>
      </div>
      <StarRating rating={review.rating} size="w-4 h-4" />
      <p className="text-sm text-zinc-400 leading-relaxed">{review.text}</p>
    </div>
  );
}

function getTimeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'zojuist';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}u`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 2592000)}ma`;
}

export default function ReviewSection({ lang = 'nl', variant = 'dark' }) {
  const [reviews, setReviews] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(0);
  const t = labels[lang] || labels.nl;
  const perPage = 3;

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isDealer = user?.role === 'dealer';

  useEffect(() => {
    fetch(`${API}/api/reviews`)
      .then((r) => r.json())
      .then(setReviews)
      .catch(() => {});
  }, []);

  const avgRating = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  const totalPages = Math.ceil(reviews.length / perPage);
  const visibleReviews = reviews.slice(page * perPage, (page + 1) * perPage);

  const handleSubmit = async () => {
    if (rating === 0 || text.length < 10) return;
    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch(`${API}/api/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating, text, anonymous }),
      });
      if (res.ok) {
        setMessage(t.success);
        setShowForm(false);
        setRating(0);
        setText('');
        // Refresh reviews
        const updated = await fetch(`${API}/api/reviews`).then((r) => r.json());
        setReviews(updated);
      } else {
        const err = await res.json();
        setMessage(err.detail || 'Error');
      }
    } catch {
      setMessage('Error');
    }
    setSubmitting(false);
  };

  const isDark = variant === 'dark';
  const sectionBg = isDark ? 'bg-zinc-900/40' : 'bg-zinc-50 rounded-2xl border border-zinc-200';
  const cardBg = isDark ? 'bg-zinc-900/80 border-zinc-800/60' : 'bg-white border-zinc-200 shadow-sm';
  const titleColor = 'text-red-500';
  const scoreColor = isDark ? 'text-white' : 'text-zinc-900';
  const subColor = isDark ? 'text-zinc-500' : 'text-zinc-500';
  const nameColor = isDark ? 'text-zinc-300' : 'text-zinc-700';
  const textColor = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const dateColor = isDark ? 'text-zinc-600' : 'text-zinc-400';
  const avatarBg = isDark ? 'bg-zinc-800' : 'bg-zinc-100';
  const inputBg = isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600' : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400';
  const pageBtnBg = isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300';

  return (
    <section className={`py-12 sm:py-16 ${sectionBg}`} data-testid="reviews-section">
      <div className={`${isDark ? 'max-w-6xl mx-auto' : ''} px-4 sm:px-6`}>
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className={`text-base sm:text-lg font-bold ${titleColor} uppercase tracking-widest mb-4`}>
            {t.title}
          </h2>
          {reviews.length > 0 && (
            <div className="flex items-center justify-center gap-3">
              <StarRating rating={Math.round(parseFloat(avgRating))} size="w-5 h-5" />
              <span className={`text-2xl font-black ${scoreColor}`} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                {avgRating}
              </span>
              <span className={`text-sm ${subColor}`}>
                ({reviews.length} review{reviews.length !== 1 ? 's' : ''})
              </span>
            </div>
          )}
        </div>

        {/* Reviews grid */}
        {reviews.length === 0 ? (
          <p className={`text-center ${subColor} text-sm mb-8`}>{t.no_reviews}</p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
              {visibleReviews.map((r) => (
                <div key={r.id} className={`border rounded-2xl p-6 flex flex-col gap-3 min-w-0 ${cardBg}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 ${avatarBg} rounded-full flex items-center justify-center`}>
                        <User className={`w-4 h-4 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                      </div>
                      <span className={`text-sm font-medium ${nameColor} truncate`}>
                        {r.dealer_company}
                      </span>
                    </div>
                    <span className={`text-xs ${dateColor} flex-shrink-0`}>{getTimeAgo(new Date(r.created_at))}</span>
                  </div>
                  <StarRating rating={r.rating} size="w-4 h-4" />
                  <p className={`text-sm ${textColor} leading-relaxed`}>{r.text}</p>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mb-8">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className={`p-2 rounded-lg disabled:opacity-30 transition-colors ${pageBtnBg}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className={`text-sm ${subColor}`}>
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className={`p-2 rounded-lg disabled:opacity-30 transition-colors ${pageBtnBg}`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Write review button / form */}
        <div className="text-center">
          {message && (
            <p className={`text-sm mb-4 ${message === t.success ? 'text-green-400' : 'text-red-400'}`}>
              {message}
            </p>
          )}

          {!showForm && isDealer && (
            <Button
              data-testid="write-review-btn"
              onClick={() => setShowForm(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-medium"
            >
              <Star className="w-4 h-4 mr-2" /> {t.write}
            </Button>
          )}

          {!isDealer && !showForm && (
            <p className="text-sm text-zinc-600">{t.login_required}</p>
          )}

          {showForm && (
            <div className={`max-w-lg mx-auto border rounded-2xl p-6 mt-4 text-left ${cardBg}`}>
              {/* Star rating */}
              <div className="mb-4">
                <StarRating rating={rating} onRate={setRating} interactive size="w-8 h-8" />
              </div>

              {/* Text */}
              <textarea
                data-testid="review-text-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t.placeholder}
                rows={4}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500/50 resize-none mb-3 ${inputBg}`}
              />
              {text.length > 0 && text.length < 10 && (
                <p className="text-xs text-red-400 mb-2">{t.min_chars}</p>
              )}

              {/* Anonymous toggle */}
              <label className="flex items-center gap-2 cursor-pointer mb-4">
                <input
                  data-testid="review-anonymous-toggle"
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-400 text-red-600 focus:ring-red-500"
                />
                <span className={`text-sm ${textColor}`}>{t.anonymous}</span>
              </label>

              {/* Submit */}
              <div className="flex gap-3">
                <Button
                  data-testid="submit-review-btn"
                  onClick={handleSubmit}
                  disabled={rating === 0 || text.length < 10 || submitting}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-medium disabled:opacity-50"
                >
                  <Send className="w-4 h-4 mr-2" /> {submitting ? '...' : t.submit}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setShowForm(false); setRating(0); setText(''); }}
                  className="text-zinc-500 hover:text-white"
                >
                  ✕
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
