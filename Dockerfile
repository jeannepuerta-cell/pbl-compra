FROM node:20-bookworm

RUN apt-get update && apt-get install -y \
    git curl sudo ripgrep jq \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash -u 1001 pastel \
    && echo "pastel ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

ENV NPM_CONFIG_PREFIX=/home/pastel/.npm-global
ENV PATH=/home/pastel/.npm-global/bin:$PATH

USER pastel
WORKDIR /home/pastel/app

RUN mkdir -p /home/pastel/.npm-global \
    && npm install -g @anthropic-ai/claude-code

CMD ["bash"]
