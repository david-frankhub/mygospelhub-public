const likeBtn = document.getElementById('likeBtn');
  const likeCount = document.getElementById('likeCount');
  let liked = true;
  likeBtn.addEventListener('click', () => {
    liked = !liked;
    likeBtn.classList.toggle('liked', liked);
    likeCount.textContent = liked ? '48.2K' : '48.1K';
  });

  const input = document.querySelector('.comment-input input');
  const commentList = document.getElementById('commentList');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      const div = document.createElement('div');
      div.className = 'comment';
      div.innerHTML = `
        <div class="comment-avatar"></div>
        <div class="comment-body">
          <div class="comment-name">You <span>just now</span></div>
          <div class="comment-text">${input.value.replace(/</g,"&lt;")}</div>
          <div class="comment-actions"><button>Like</button><button>Reply</button></div>
        </div>`;
      commentList.prepend(div);
      input.value = '';
    }
  });
