import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  displayCGU(): any {
    return `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>CGU - RDS CONNECT</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.8;
              color: #2c3e50;
              background: linear-gradient(135deg, #3857e2ff 0%, #285fceff 100%);
              min-height: 100vh;
              padding: 20px;
            }

            .container {
              max-width: 1000px;
              margin: 0 auto;
              background: white;
              border-radius: 20px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              overflow: hidden;
            }

            .header {
              background: linear-gradient(135deg, #3857e2ff 0%, #285fceff 100%);

              color: white;
              padding: 60px 40px;
              text-align: center;
            }

            .header h1 {
              font-size: 2.5em;
              margin-bottom: 10px;
              font-weight: 700;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
            }

            .header p {
              font-size: 1.1em;
              opacity: 0.95;
            }

            .content {
              padding: 50px 40px;
            }

            .article {
              margin-bottom: 40px;
              padding-bottom: 30px;
              border-bottom: 2px solid #f0f0f0;
            }

            .article:last-child {
              border-bottom: none;
            }

            .article-title {
              color: #667eea;
              font-size: 1.6em;
              font-weight: 700;
              margin-bottom: 20px;
              display: flex;
              align-items: center;
              gap: 10px;
            }

            .article-number {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              width: 40px;
              height: 40px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 0.8em;
              flex-shrink: 0;
            }

            .section {
              margin-bottom: 25px;
            }

            .section-title {
              font-weight: 600;
              color: #764ba2;
              margin-bottom: 12px;
              font-size: 1.15em;
            }

            p {
              margin-bottom: 15px;
              text-align: justify;
            }

            ul {
              margin-left: 30px;
              margin-bottom: 15px;
            }

            li {
              margin-bottom: 10px;
              padding-left: 10px;
            }

            .highlight-box {
              background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
              border-left: 4px solid #667eea;
              padding: 20px;
              margin: 20px 0;
              border-radius: 8px;
            }

            .info-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 20px;
              margin: 20px 0;
            }

            .info-card {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 10px;
              border: 1px solid #e9ecef;
            }

            .info-card strong {
              color: #667eea;
              display: block;
              margin-bottom: 8px;
            }

            .footer {
              background: #2c3e50;
              color: white;
              padding: 30px 40px;
              text-align: center;
            }

            .scroll-top {
              position: fixed;
              bottom: 30px;
              right: 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              width: 50px;
              height: 50px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              box-shadow: 0 4px 15px rgba(0,0,0,0.3);
              transition: transform 0.3s ease;
              text-decoration: none;
              font-size: 24px;
            }

            .scroll-top:hover {
              transform: translateY(-5px);
            }

            @media (max-width: 768px) {
              .header h1 {
                font-size: 1.8em;
              }

              .content {
                padding: 30px 20px;
              }

              .article-title {
                font-size: 1.3em;
              }

              .info-grid {
                grid-template-columns: 1fr;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>RDS CONNECT</h1>
              <p>Conditions Générales d'Utilisation</p>
            </div>

            <div class="content">
              <!-- ARTICLE 1 -->
              <div class="article">
                <h2 class="article-title">
                  <span class="article-number">1</span>
                  Objet
                </h2>
                <p>Les présentes « conditions générales d'utilisation » ont pour objet l'encadrement juridique de l'utilisation de l'application mobile <strong>RDS CONNECT</strong> et de ses services.</p>
                
                <div class="highlight-box">
                  <p><strong>Ce contrat est conclu entre :</strong></p>
                  <ul>
                    <li>La société RDS CONNECT, ci-après désigné « l'Éditeur »</li>
                    <li>Toute personne physique ou morale souhaitant accéder à l'application mobile et à ses services, ci-après appelé « l'Utilisateur »</li>
                  </ul>
                </div>
                
                <p>Les conditions générales d'utilisation doivent être acceptées par tout Utilisateur, et son accès à l'application vaut acceptation de ces conditions.</p>
              </div>

              <!-- ARTICLE 2 -->
              <div class="article">
                <h2 class="article-title">
                  <span class="article-number">2</span>
                  Mentions légales
                </h2>
                
                <div class="section">
                  <h3 class="section-title">📋 Informations relatives à l'éditeur :</h3>
                  <div class="info-grid">
                    <div class="info-card">
                      <strong>Société</strong>
                      RDS CONNECT - SAS au capital de 2000 €
                    </div>
                    <div class="info-card">
                      <strong>Siège social</strong>
                      26 Avenue du 6 juin 1944<br>95190 GOUSSAINVILLE
                    </div>
                    <div class="info-card">
                      <strong>RCS</strong>
                      Pontoise 945 124 477
                    </div>
                    <div class="info-card">
                      <strong>Représentant</strong>
                      M. RAGAVAN Rexer, Président
                    </div>
                  </div>
                </div>

                <div class="section">
                  <h3 class="section-title">🖥️ Informations relatives à l'hébergeur :</h3>
                  <div class="info-card">
                    <strong>OVHcloud SAS</strong>
                    Capital : 10 174 560 €<br>
                    RCS Lille Métropole 424 761 419 00045<br>
                    Siège social : 2, rue Kellermann – 59100 Roubaix – France<br>
                    Téléphone : 09 72 10 10 07<br>
                    Site internet : www.ovhcloud.com
                  </div>
                </div>
              </div>

              <!-- ARTICLE 3 -->
              <div class="article">
                <h2 class="article-title">
                  <span class="article-number">3</span>
                  Description de l'application mobile et conditions d'accessibilité
                </h2>
                
                <p>L'Application a pour objet de permettre aux utilisateurs abonnés d'afficher, sur un écran de télévision compatible, des contenus dynamiques tels que des menus, visuels promotionnels ou messages personnalisés. L'Application comprend notamment un module d'administration accessible depuis un terminal mobile, permettant aux utilisateurs de créer, modifier et gérer les contenus diffusés sur leur écran.</p>
                
                <div class="highlight-box">
                  <p>L'accès aux fonctionnalités de l'Application est strictement conditionné à la souscription d'un abonnement mensuel ou annuel, selon la formule choisie lors de l'inscription. L'Application est accessible exclusivement aux utilisateurs disposant d'un compte actif et d'un abonnement en cours de validité.</p>
                </div>
                
                <p>L'Éditeur se réserve le droit de faire évoluer l'Application, tant dans sa forme que dans ses fonctionnalités, sans que ces évolutions ne puissent altérer la qualité essentielle des services souscrits.</p>
                
                <p>L'Application et ses différents services peuvent être interrompus ou suspendus par l'Éditeur, notamment à l'occasion d'une maintenance, sans obligation de préavis ou de justification.</p>
              </div>

              <!-- ARTICLE 4 -->
              <div class="article">
                <h2 class="article-title">
                  <span class="article-number">4</span>
                  Conditions d'accès et d'utilisation
                </h2>
                
                <div class="section">
                  <h3 class="section-title">4.1 Accès au Service</h3>
                  <p>L'accès à l'Application nécessite :</p>
                  <ul>
                    <li>La création d'un compte utilisateur</li>
                    <li>La souscription d'un abonnement mensuel ou annuel</li>
                    <li>L'installation de l'Application sur un terminal mobile compatible</li>
                    <li>La connexion à un écran de télévision ou un dispositif équivalent permettant l'affichage des contenus</li>
                  </ul>
                  <p>L'utilisateur est responsable de disposer de l'équipement matériel et logiciel nécessaire, ainsi que d'un accès Internet suffisant pour assurer le bon fonctionnement de l'Application.</p>
                </div>

                <div class="section">
                  <h3 class="section-title">4.2 Création et gestion du compte</h3>
                  <p>Lors de la création du compte, l'utilisateur doit fournir des informations exactes, complètes et à jour. Il s'engage à mettre immédiatement à jour toute modification de ces informations.</p>
                  <div class="highlight-box">
                    <p>Les identifiants de connexion sont strictement personnels et confidentiels. Toute utilisation du compte réalisée à l'aide de ces identifiants est présumée effectuée par l'utilisateur, qui en assume l'entière responsabilité.</p>
                  </div>
                </div>

                <div class="section">
                  <h3 class="section-title">4.3 Règles générales d'utilisation</h3>
                  <p>L'utilisateur s'engage à utiliser l'Application conformément aux lois et réglementations applicables, ainsi qu'aux présentes Conditions Générales d'Utilisation.</p>
                  <p><strong>Il lui est notamment interdit de :</strong></p>
                  <ul>
                    <li>Détourner l'Application de sa finalité</li>
                    <li>Transmettre ou diffuser des contenus illicites, discriminatoires, violents, diffamatoires ou portant atteinte aux droits de tiers</li>
                    <li>Tenter d'accéder de manière frauduleuse aux systèmes informatiques de l'Éditeur</li>
                    <li>Procéder à toute ingénierie inverse, décompilation ou modification non autorisée de l'Application</li>
                    <li>Utiliser l'Application pour diffuser des messages commerciaux non sollicités ou constitutifs de spam</li>
                  </ul>
                  <p>L'Éditeur se réserve le droit de suspendre ou résilier l'accès de tout utilisateur qui contreviendrait aux présentes règles.</p>
                </div>

                <div class="section">
                  <h3 class="section-title">4.4 Compatibilité et disponibilité</h3>
                  <p>L'utilisateur reconnaît que la disponibilité et les performances de l'Application peuvent dépendre :</p>
                  <ul>
                    <li>Du matériel utilisé</li>
                    <li>De la qualité de la connexion Internet</li>
                    <li>Des mises à jour logicielles du terminal ou de la télévision connectée</li>
                  </ul>
                  <p>L'Éditeur ne saurait être tenu responsable d'éventuels dysfonctionnements résultant d'une incompatibilité technique ou d'un environnement réseau défaillant.</p>
                </div>
              </div>

              <!-- ARTICLE 5 -->
              <div class="article">
                <h2 class="article-title">
                  <span class="article-number">5</span>
                  Responsabilités
                </h2>
                
                <p>L'Éditeur s'engage à fournir l'Application et les services associés conformément aux règles de l'art et aux dispositions des présentes Conditions Générales d'Utilisation. Toutefois, l'Éditeur n'est tenu qu'à une <strong>obligation de moyens</strong>, la fourniture d'un service numérique dépendant notamment de facteurs externes (connexion Internet, performance des équipements, disponibilité des réseaux, etc.).</p>
                
                <div class="highlight-box">
                  <p>L'utilisateur reconnaît expressément que l'utilisation de l'Application se fait sous sa seule responsabilité. Il lui appartient de vérifier l'adéquation du service à ses besoins, ainsi que de s'assurer du bon fonctionnement et de la compatibilité de son matériel (télévision, dispositif d'affichage, terminal mobile, connexion réseau).</p>
                </div>
                
                <p><strong>L'Éditeur ne pourra être tenu responsable :</strong></p>
                <ul>
                  <li>De toute interruption, suspension ou indisponibilité temporaire de l'Application liée à des opérations de maintenance, à une panne du réseau, à un incident technique ou à un cas de force majeure</li>
                  <li>De pertes de données, dommages indirects, manque à gagner, pertes d'exploitation, préjudices commerciaux ou immatériels subis par l'utilisateur</li>
                  <li>De tout dysfonctionnement résultant d'une mauvaise utilisation, d'une manipulation non conforme, de la diffusion de contenus illicites par l'utilisateur ou de toute violation des présentes CGU</li>
                  <li>De dommages causés par des tiers ou par des attaques informatiques ne pouvant raisonnablement être empêchées malgré les mesures de sécurité mises en place</li>
                </ul>
                
                <p>L'utilisateur demeure seul responsable des contenus qu'il crée, diffuse ou paramètre via l'Application (menus, messages, visuels, etc.). Il garantit que ces contenus ne contreviennent à aucune loi, règlementation ou droit de tiers et s'engage à indemniser l'Éditeur en cas de réclamation, recours ou dommages résultant de leur diffusion.</p>
              </div>

              <!-- ARTICLE 6 -->
              <div class="article">
                <h2 class="article-title">
                  <span class="article-number">6</span>
                  Disponibilité et maintenance
                </h2>
                
                <p>L'Éditeur s'efforce d'assurer l'accès continu et la bonne disponibilité de l'Application. Toutefois, l'utilisateur est informé que l'accès au service peut être temporairement interrompu ou dégradé en raison :</p>
                
                <ul>
                  <li>D'opérations de maintenance, d'amélioration ou de mise à jour de l'Application</li>
                  <li>D'interventions techniques nécessaires au bon fonctionnement des serveurs ou infrastructures</li>
                  <li>De pannes, coupures réseaux, saturations ou incidents extérieurs hors du contrôle de l'Éditeur</li>
                  <li>De cas de force majeure au sens de l'article 1218 du Code civil</li>
                </ul>
                
                <div class="highlight-box">
                  <p>Dans la mesure du possible, l'Éditeur informera les utilisateurs des opérations de maintenance programmée susceptibles d'affecter temporairement l'accès au service. L'Éditeur ne saurait toutefois être tenu pour responsable des conséquences de ces interruptions ni accorder une indemnisation spécifique, dès lors que celles-ci sont inhérentes à la gestion et à l'évolution d'un service numérique.</p>
                </div>
                
                <p>L'Éditeur se réserve également la faculté de modifier à tout moment les fonctionnalités, l'ergonomie, l'interface ou les moyens techniques de l'Application, dès lors que ces modifications n'altèrent pas la qualité essentielle du service souscrit. Les mises à jour peuvent être obligatoires pour garantir la sécurité et la stabilité du service ; l'utilisateur s'engage à maintenir son terminal et l'application à jour.</p>
              </div>

              <!-- ARTICLE 7 -->
              <div class="article">
                <h2 class="article-title">
                  <span class="article-number">7</span>
                  Propriété intellectuelle
                </h2>
                
                <p>L'ensemble des éléments composant l'Application, et notamment son architecture, son ergonomie, son design, ses interfaces, bases de données, textes, images, vidéos, logos, marques, noms commerciaux, ainsi que le code source et le code objet, sont protégés par les lois et réglementations françaises et internationales relatives à la propriété intellectuelle.</p>
                
                <div class="highlight-box">
                  <p>Ces éléments sont la propriété exclusive de l'Éditeur ou de ses partenaires ayant autorisé leur utilisation. Aucune cession de droits de propriété intellectuelle n'est effectuée à l'utilisateur au titre des présentes Conditions Générales d'Utilisation.</p>
                </div>
                
                <p>L'Éditeur concède à l'utilisateur, pour la durée de son abonnement et sur le territoire convenu, une licence personnelle, non exclusive, non transférable et non cessible d'utilisation de l'Application, strictement limitée aux fonctionnalités décrites dans les présentes CGU.</p>
                
                <p><strong>L'utilisateur s'interdit notamment de :</strong></p>
                <ul>
                  <li>Reproduire, copier, modifier, adapter, traduire ou créer des œuvres dérivées à partir de l'Application</li>
                  <li>Procéder à toute extraction substantielle ou répétée des bases de données</li>
                  <li>Réaliser de l'ingénierie inverse, décompiler ou tenter d'accéder au code source</li>
                  <li>Supprimer ou altérer toute mention de propriété ou de droits d'auteur</li>
                  <li>Diffuser, louer, prêter, ou transférer la licence d'utilisation de l'Application à un tiers</li>
                </ul>
                
                <p>Toute violation de ces dispositions expose l'utilisateur à des poursuites civiles et pénales, conformément aux articles L.335-2 et suivants du Code de la propriété intellectuelle.</p>
                
                <p>L'Éditeur se réserve le droit de modérer ou de supprimer librement et à tout moment les contenus mis en ligne par les utilisateurs, et ce sans justification.</p>
              </div>

              <!-- ARTICLE 8 -->
              <div class="article">
                <h2 class="article-title">
                  <span class="article-number">8</span>
                  Données personnelles
                </h2>
                
                <div class="section">
                  <h3 class="section-title">8.1 Responsable du traitement</h3>
                  <p>Les données personnelles collectées dans le cadre de l'utilisation de l'Application sont traitées par RDS CONNECT, agissant en qualité de responsable du traitement au sens du Règlement (UE) 2016/679 du 27 avril 2016 (RGPD) et de la loi Informatique et Libertés.</p>
                </div>

                <div class="section">
                  <h3 class="section-title">8.2 Données collectées</h3>
                  <p>Dans le cadre de l'inscription, de l'utilisation et de la facturation du service, l'Éditeur est susceptible de collecter les données suivantes :</p>
                  <ul>
                    <li><strong>Identité :</strong> nom, prénom</li>
                    <li><strong>Coordonnées :</strong> adresse email, téléphone (si nécessaire)</li>
                    <li><strong>Données de connexion :</strong> identifiants, logs techniques, adresse IP</li>
                    <li>Informations relatives au compte et à l'abonnement</li>
                    <li>Données d'utilisation de l'Application (paramétrages, contenus créés, actions techniques)</li>
                    <li>Données de paiement (traitées par un prestataire certifié et non conservées par l'Éditeur)</li>
                  </ul>
                  <p><em>Aucune donnée sensible (au sens de l'article 9 RGPD) n'est collectée.</em></p>
                </div>

                <div class="section">
                  <h3 class="section-title">8.3 Finalités et bases légales</h3>
                  <p><strong>Les traitements de données personnelles ont pour finalités :</strong></p>
                  <ul>
                    <li>La gestion des comptes utilisateurs et des abonnements</li>
                    <li>La facturation et le traitement des paiements</li>
                    <li>La fourniture et l'amélioration des fonctionnalités de l'Application</li>
                    <li>La gestion du support technique et des réclamations</li>
                    <li>La sécurisation de l'Application et la prévention des fraudes</li>
                    <li>L'envoi d'informations liées au service ou nécessités contractuelles</li>
                  </ul>
                  
                  <div class="highlight-box">
                    <p><strong>Les bases légales des traitements sont :</strong></p>
                    <ul>
                      <li>L'exécution du contrat (article 6.1.b RGPD) pour la gestion du compte et de l'abonnement</li>
                      <li>L'intérêt légitime de l'Éditeur (article 6.1.f) pour la sécurité du service et l'amélioration de l'expérience utilisateur</li>
                      <li>Le respect d'obligations légales (article 6.1.c) pour la conservation des données de facturation</li>
                    </ul>
                  </div>
                </div>

                <div class="section">
                  <h3 class="section-title">8.4 Destinataires des données</h3>
                  <p>Les données sont destinées uniquement :</p>
                  <ul>
                    <li>Aux services internes de l'Éditeur</li>
                    <li>Aux prestataires techniques intervenant pour l'hébergement, la maintenance ou le paiement</li>
                    <li>Aux autorités administratives ou judiciaires en cas d'obligation légale</li>
                  </ul>
                  <p><strong>Aucune donnée n'est vendue à des tiers.</strong></p>
                </div>

                <div class="section">
                  <h3 class="section-title">8.5 Hébergement des données</h3>
                  <p>Les données sont hébergées par <strong>OVH</strong>, situé 2, rue Kellermann – 59100 Roubaix – France et offrant des garanties conformes au RGPD.</p>
                  <p>En cas de transfert en dehors de l'Union européenne, des garanties appropriées (clauses contractuelles types, etc.) seraient mises en œuvre.</p>
                </div>

                <div class="section">
                  <h3 class="section-title">8.6 Durées de conservation</h3>
                  <p>Les données sont conservées uniquement pour la durée nécessaire aux finalités pour lesquelles elles sont collectées, à savoir :</p>
                  <ul>
                    <li><strong>Données liées au compte :</strong> tant que l'abonnement est actif, puis 3 ans à compter de la désactivation</li>
                    <li><strong>Données de facturation :</strong> 10 ans (obligation légale)</li>
                    <li><strong>Logs techniques :</strong> 12 mois maximum</li>
                    <li><strong>Données relatives au support :</strong> durée du traitement + 6 mois</li>
                  </ul>
                </div>

                <div class="section">
                  <h3 class="section-title">8.7 Droits des utilisateurs</h3>
                  <div class="highlight-box">
                    <p>Conformément au RGPD, l'utilisateur dispose des droits suivants :</p>
                    <ul>
                      <li>Droit d'accès</li>
                      <li>Droit de rectification</li>
                      <li>Droit d'effacement</li>
                      <li>Droit à la limitation du traitement</li>
                      <li>Droit d'opposition</li>
                      <li>Droit à la portabilité des données</li>
                      <li>Droit d'introduire une réclamation auprès de la CNIL</li>
                    </ul>
                    <p>L'exercice de ces droits peut être sollicité auprès de : <strong>rdsconnect.contact@gmail.com</strong></p>
                  </div>
                </div>

                <div class="section">
                  <h3 class="section-title">8.8 Sécurité des données</h3>
                  <p>L'Éditeur met en œuvre toutes les mesures techniques et organisationnelles appropriées afin de garantir la confidentialité, l'intégrité et la sécurité des données personnelles.</p>
                </div>

                <div class="section">
                  <h3 class="section-title">8.9 Politique de confidentialité</h3>
                  <p>Une politique de confidentialité détaillée est mise à disposition de l'utilisateur et précise les modalités complètes de traitement des données personnelles. En cas de contradiction entre cette politique et les présentes CGU, la politique de confidentialité prévaut pour les aspects liés aux données personnelles.</p>
                </div>
              </div>

              <!-- ARTICLE 9 -->
              <div class="article">
                <h2 class="article-title">
                  <span class="article-number">9</span>
                  Droit de rétractation
                </h2>
                
                <div class="section">
                  <h3 class="section-title">9.1 Principe</h3>
                  <p>Conformément aux articles L221-18 et suivants du Code de la consommation, l'utilisateur ayant souscrit un abonnement à distance bénéficie d'un délai de <strong>quatorze (14) jours</strong> pour exercer son droit de rétractation, sans avoir à motiver sa décision ni à supporter d'autres frais que ceux prévus par la loi.</p>
                  <p>Le délai court à compter du jour de la conclusion du contrat d'abonnement.</p>
                  <p>L'utilisateur peut exercer ce droit en adressant à l'Éditeur une déclaration dénuée d'ambiguïté exprimant sa volonté de se rétracter, ou en utilisant le formulaire type prévu par la loi.</p>
                </div>

                <div class="section">
                  <h3 class="section-title">9.2 Renonciation au droit de rétractation</h3>
                  <div class="highlight-box">
                    <p>Conformément à l'article L221-28, 13° du Code de la consommation, le droit de rétractation ne peut être exercé lorsque :</p>
                    <ul>
                      <li>L'exécution de la prestation de services numériques a commencé avant la fin du délai de rétractation, et</li>
                      <li>L'utilisateur a donné son accord préalable exprès pour commencer l'exécution du service avant la fin du délai de rétractation,</li>
                      <li>Et a reconnu perdre son droit de rétractation.</li>
                    </ul>
                    <p>Dans ce cas, aucune demande de remboursement ne pourra être acceptée pour la période d'abonnement en cours.</p>
                  </div>
                </div>

                <div class="section">
                  <h3 class="section-title">9.3 Absence de renonciation</h3>
                  <p>Si l'utilisateur n'a pas expressément renoncé à son droit de rétractation, il conserve la possibilité d'exercer ce droit dans le délai légal. L'Éditeur procédera alors au remboursement des sommes perçues, déduction faite, le cas échéant, du montant correspondant au service déjà fourni à la date de réception de la demande de rétractation, conformément à l'article L221-25 du Code de la consommation.</p>
                </div>

                <div class="section">
                  <h3 class="section-title">9.4 Modalités d'exercice</h3>
                  <p>Pour exercer son droit de rétractation, l'utilisateur doit adresser sa demande à l'adresse suivante : <strong>rdsconnect.contact@gmail.com</strong> ou par tout autre moyen permettant de rapporter la preuve de sa demande.</p>
                  <p>Le remboursement interviendra dans un délai maximum de 14 jours à compter de la réception de la demande, selon le même moyen de paiement que celui utilisé lors de la transaction initiale, sauf accord contraire de l'utilisateur.</p>
                </div>
              </div>

              <!-- ARTICLE 10 -->
              <div class="article">
                <h2 class="article-title">
                  <span class="article-number">10</span>
                  Évolution des conditions générales d'utilisation
                </h2>
                
                <p>L'Éditeur se réserve le droit de modifier, à tout moment et sans préavis, tout ou partie des présentes Conditions Générales d'Utilisation, notamment afin de les adapter aux évolutions légales, réglementaires, techniques ou fonctionnelles de l'Application.</p>
                
                <div class="highlight-box">
                  <p>Les modifications apportées aux CGU seront opposables à l'utilisateur dès leur mise en ligne. Lorsque les modifications sont substantielles ou affectent de manière significative les droits et obligations des utilisateurs, ceux-ci seront informés par tout moyen approprié, notamment via une notification dans l'Application ou par courrier électronique à l'adresse associée à leur compte.</p>
                </div>
                
                <p>Dans ce cas, l'utilisateur sera invité à prendre connaissance de la nouvelle version des CGU et, le cas échéant, à l'accepter pour pouvoir continuer à utiliser l'Application.</p>
                
                <p>En cas de désaccord avec les modifications apportées, l'utilisateur conserve la possibilité de résilier son abonnement selon les modalités prévues aux présentes CGU. À défaut de résiliation, l'utilisation continue de l'Application emporte acceptation sans réserve de la dernière version des CGU.</p>
                
                <p>L'Éditeur recommande à l'utilisateur de consulter régulièrement les CGU afin de prendre connaissance des éventuelles mises à jour.</p>
              </div>

              <!-- ARTICLE 11 -->
              <div class="article">
                <h2 class="article-title">
                  <span class="article-number">11</span>
                  Durée du contrat
                </h2>
                
                <p>La durée du présent contrat est <strong>indéterminée</strong>. Le contrat produit ses effets à l'égard de l'Utilisateur à compter du début de l'utilisation du service.</p>
              </div>

              <!-- ARTICLE 12 -->
              <div class="article">
                <h2 class="article-title">
                  <span class="article-number">12</span>
                  Résiliation
                </h2>
                
                <div class="section">
                  <h3 class="section-title">12.1 Résiliation par l'utilisateur (avec préavis de 2 semaines)</h3>
                  <p>L'utilisateur peut résilier son abonnement à tout moment, sous réserve de respecter un préavis de <strong>deux (2) semaines</strong> avant la fin de la période d'abonnement en cours.</p>
                  
                  <div class="highlight-box">
                    <p>La résiliation ne produit effet qu'à l'issue de la période contractuelle mensuelle ou annuelle déjà réglée. Aucun remboursement partiel ne pourra être effectué pour la période en cours, sauf dispositions légales impératives.</p>
                  </div>
                  
                  <p><strong>Modalités selon le mode de souscription :</strong></p>
                  <ul>
                    <li><strong>Abonnement via store applicatif (App Store, Google Play) :</strong> L'utilisateur doit procéder à la résiliation directement depuis l'interface de gestion des abonnements du store concerné. L'Éditeur ne peut résilier ou modifier un abonnement souscrit par l'intermédiaire d'un store tiers.</li>
                    <li><strong>Abonnement souscrit directement auprès de l'Éditeur :</strong> La demande de résiliation doit être adressée à : <strong>rdsconnect.contact@gmail.com</strong></li>
                  </ul>
                  
                  <p>Toute demande de résiliation transmise hors délai de préavis pourra entraîner le renouvellement automatique de l'abonnement pour une nouvelle période.</p>
                  <p>L'utilisateur conservera l'accès à l'Application jusqu'à l'expiration de la période d'abonnement en cours.</p>
                </div>

                <div class="section">
                  <h3 class="section-title">12.2 Résiliation par l'Éditeur</h3>
                  <p>L'Éditeur peut résilier l'accès de l'utilisateur à tout moment, sans préavis, en cas de :</p>
                  <ul>
                    <li>Violation grave ou répétée des CGU</li>
                    <li>Utilisation frauduleuse ou détournée de l'Application</li>
                    <li>Tentative d'accès non autorisé aux systèmes de l'Éditeur</li>
                    <li>Diffusion de contenus illicites, offensants ou violant les droits de tiers</li>
                    <li>Non-paiement d'une échéance malgré relance</li>
                    <li>Comportement de nature à nuire au service ou à l'image de l'Éditeur</li>
                  </ul>
                  <p>Selon la gravité des faits, la résiliation peut être immédiate et sans indemnité. Aucun remboursement pro rata temporis de la période d'abonnement en cours ne sera effectué.</p>
                </div>

                <div class="section">
                  <h3 class="section-title">12.3 Effets de la résiliation</h3>
                  <p>La résiliation, quelle qu'en soit la cause, entraîne :</p>
                  <ul>
                    <li>La désactivation du compte utilisateur à la date d'effet de la résiliation</li>
                    <li>La fin de la licence d'utilisation de l'Application</li>
                    <li>La suppression ou anonymisation des données du compte conformément à la politique de conservation</li>
                    <li>La perte d'accès à l'ensemble des contenus et paramètres associés au compte</li>
                  </ul>
                  <p>Certaines clauses survivront à la résiliation (propriété intellectuelle, responsabilité, données personnelles).</p>
                </div>

                <div class="section">
                  <h3 class="section-title">12.4 Suspension du service</h3>
                  <p>En cas d'incident de paiement, d'utilisation non conforme ou de risque pour la sécurité du service, l'Éditeur peut suspendre temporairement l'accès de l'utilisateur.</p>
                  <p>La régularisation de la situation permet la levée de la suspension. À défaut, une résiliation pourra être prononcée selon les modalités ci-dessus.</p>
                </div>
              </div>

              <!-- ARTICLE 13 -->
              <div class="article">
                <h2 class="article-title">
                  <span class="article-number">13</span>
                  Droit applicable et juridiction compétente
                </h2>
                
                <p>Les présentes Conditions Générales d'Utilisation sont régies par le <strong>droit français</strong>.</p>
                
                <div class="highlight-box">
                  <p>En cas de litige relatif à la validité, à l'interprétation, à l'exécution ou à la cessation des présentes CGU, et à défaut de résolution amiable entre les parties, compétence expresse et exclusive est attribuée au <strong>Tribunal de commerce de Pontoise</strong>, nonobstant pluralité de défendeurs ou appel en garantie.</p>
                </div>
                
                <p>Cette attribution de compétence s'applique sous réserve des dispositions légales impératives éventuellement applicables aux consommateurs lorsque l'utilisateur bénéficie de ce statut.</p>
              </div>
            </div>

            <div class="footer">
              <p><strong>RDS CONNECT</strong></p>
              <p>26 Avenue du 6 juin 1944, 95190 GOUSSAINVILLE</p>
              <p>Contact : rdsconnect.contact@gmail.com</p>
              <p style="margin-top: 20px; opacity: 0.8;">© 2024 RDS CONNECT - Tous droits réservés</p>
            </div>
          </div>

          <a href="#" class="scroll-top" onclick="window.scrollTo({top: 0, behavior: 'smooth'}); return false;">↑</a>

          <script>
            // Afficher/masquer le bouton de scroll selon la position
            window.addEventListener('scroll', function() {
              const scrollTop = document.querySelector('.scroll-top');
              if (window.pageYOffset > 300) {
                scrollTop.style.display = 'flex';
              } else {
                scrollTop.style.display = 'none';
              }
            });
          </script>
        </body>
      </html>
    `;
  }

  accountdeletion(): any {
    return `
    <!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Suppression de compte — RDS Connect</title>
  <meta name="description" content="Procédure de suppression de votre compte et de vos données dans l'application RDS Connect." />
  <style>
    :root {
      --bg: #ffffff;
      --text: #1a1a1a;
      --muted: #555;
      --accent: #2563eb;
      --border: #e5e7eb;
      --code-bg: #f3f4f6;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 760px;
      margin: 0 auto;
      padding: 2rem 1.25rem 4rem;
      color: var(--text);
      background: var(--bg);
      line-height: 1.65;
    }
    h1 { font-size: 1.9rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.25rem; margin-top: 2.25rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--border); }
    p, li { color: var(--text); }
    .lead { color: var(--muted); margin-top: 0; }
    ol, ul { padding-left: 1.4rem; }
    li { margin: 0.4rem 0; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: var(--code-bg); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
    .meta { color: var(--muted); font-size: 0.9rem; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border); }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { text-align: left; padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--border); font-size: 0.95rem; }
    th { background: var(--code-bg); font-weight: 600; }
  </style>
</head>
<body>

  <h1>Suppression de votre compte et de vos données</h1>
  <p class="lead">Application : <strong>RDS Connect</strong></p>

  <p>
    Conformément aux exigences de Google Play et au Règlement Général sur la Protection
    des Données (RGPD), vous pouvez à tout moment demander la suppression de votre
    compte ainsi que des données associées.
  </p>

  <h2>Méthode 1 — Depuis l'application (recommandée)</h2>
  <ol>
    <li>Ouvrez l'application <strong>RDS Connect</strong>.</li>
    <li>Connectez-vous avec votre compte.</li>
    <li>Accédez à <strong>Paramètres</strong> → <strong>Mon compte</strong>.</li>
    <li>Appuyez sur <strong>Supprimer mon compte</strong>.</li>
    <li>Confirmez la suppression. L'opération est définitive et immédiate.</li>
  </ol>

  <h2>Méthode 2 — Par e-mail</h2>
  <p>
    Si vous n'avez plus accès à l'application, envoyez un e-mail à
    <a href="mailto:rdsconnect.contact@gmail.com">rdsconnect.contact@gmail.com</a>
    depuis l'adresse associée à votre compte, avec pour objet
    <code>Suppression de compte</code>.
  </p>
  <p>
    Votre demande sera traitée sous <strong>30 jours maximum</strong>. Une confirmation
    vous sera envoyée par e-mail une fois la suppression effectuée.
  </p>

  <h2>Données supprimées</h2>
  <p>Lors de la suppression de votre compte, les données suivantes sont définitivement effacées :</p>
  <ul>
    <li>Informations de profil : nom, prénom, e-mail, téléphone, avatar, entreprise, service, ville</li>
    <li>Identifiants d'authentification (mot de passe, jetons de session)</li>
    <li>Téléviseurs associés à votre compte et leurs codes de connexion</li>
    <li>Médias téléversés (images, vidéos, documents) et leurs miniatures</li>
    <li>Listes de lecture et programmations</li>
    <li>Journaux d'activité liés à vos appareils</li>
  </ul>

  <h2>Données conservées</h2>
  <p>
    Certaines données peuvent être conservées pour des raisons légales, fiscales ou
    de sécurité, conformément à la législation applicable :
  </p>
  <table>
    <thead>
      <tr><th>Type de donnée</th><th>Durée</th><th>Motif</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>Factures et historique de paiement</td>
        <td>10 ans</td>
        <td>Obligation comptable (Code de commerce, art. L123-22)</td>
      </tr>
      <tr>
        <td>Journaux de connexion anonymisés</td>
        <td>1 an</td>
        <td>Sécurité et prévention de la fraude</td>
      </tr>
      <tr>
        <td>Données chez Stripe (paiements)</td>
        <td>Selon politique Stripe</td>
        <td>Prestataire de paiement</td>
      </tr>
    </tbody>
  </table>

  <h2>Vos autres droits</h2>
  <p>
    Conformément au RGPD, vous disposez également d'un droit d'accès, de rectification,
    d'opposition et de portabilité de vos données. Pour exercer ces droits, contactez-nous
    à <a href="mailto:rdsconnect.contact@gmail.com">rdsconnect.contact@gmail.com</a>.
  </p>

  <h2>Contact</h2>
  <p>
    Pour toute question relative à la suppression de votre compte ou au traitement de
    vos données :
  </p>
  <ul>
    <li>E-mail : <a href="mailto:rdsconnect.contact@gmail.com">rdsconnect.contact@gmail.com</a></li>
    <li>Responsable du traitement : <strong>RDS CONNECT</strong>, 26 Avenue du 6 juin 1944, 95190 GOUSSAINVILLE, France</li>
  </ul>

  <p class="meta">Dernière mise à jour : 30 avril 2026.</p>

</body>
</html>

    `;
  }

  /**
   * Simule l'envoi d'un email de support
   * En production, remplacer par un vrai service d'envoi (Nodemailer, SendGrid, etc.)
   */
  async sendSupportEmail(
    data: any,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validation des données
      this.validateContactForm(data);

      // Simulation de l'envoi d'email
      console.log('📧 ====== EMAIL DE SUPPORT ======');
      console.log('📤 Destinataire:', 'support@rdsconnect.com');
      console.log('👤 De:', `${data.name} <${data.email}>`);
      console.log('📋 Sujet:', data.subject);
      console.log('🏢 Entreprise:', data.company || 'Non renseignée');
      console.log('🆔 User ID:', data.userId || 'Non connecté');
      console.log('💬 Message:');
      console.log('─────────────────────────────────');
      console.log(data.message);
      console.log('─────────────────────────────────');
      console.log('📅 Date:', new Date().toLocaleString('fr-FR'));
      console.log('================================\n');

      // Simulation de l'email de confirmation à l'utilisateur
      console.log('📧 ====== EMAIL DE CONFIRMATION ======');
      console.log('📤 Destinataire:', data.email);
      console.log('📋 Sujet:', 'Votre demande a bien été reçue - RDS Connect');
      console.log('💬 Message:');
      console.log(`Bonjour ${data.name},

Nous avons bien reçu votre message concernant : "${data.subject}"

Notre équipe support va l'examiner et vous répondra dans les plus brefs délais, 
généralement sous 24-48 heures ouvrées.

En attendant, n'hésitez pas à consulter notre FAQ ou notre documentation.

Cordialement,
L'équipe RDS Connect

---
RDS CONNECT
26 Avenue du 6 juin 1944, 95190 GOUSSAINVILLE
rdsconnect.contact@gmail.com`);
      console.log('======================================\n');

      // Simulation d'un délai d'envoi
      await this.simulateEmailSending();

      return {
        success: true,
        message:
          'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.',
      };
    } catch (error) {
      console.error("❌ Erreur lors de l'envoi de l'email:", error);
      throw new BadRequestException(
        error.message ||
          "Une erreur est survenue lors de l'envoi de votre message.",
      );
    }
  }

  /**
   * Validation des données du formulaire
   */
  private validateContactForm(data: any): void {
    const errors: string[] = [];

    // Validation du nom
    if (!data.name || data.name.trim().length < 2) {
      errors.push('Le nom doit contenir au moins 2 caractères');
    }
    if (data.name && data.name.length > 100) {
      errors.push('Le nom ne peut pas dépasser 100 caractères');
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !emailRegex.test(data.email)) {
      errors.push('Email invalide');
    }

    // Validation du sujet
    if (!data.subject || data.subject.trim().length < 5) {
      errors.push('Le sujet doit contenir au moins 5 caractères');
    }
    if (data.subject && data.subject.length > 200) {
      errors.push('Le sujet ne peut pas dépasser 200 caractères');
    }

    // Validation du message
    if (!data.message || data.message.trim().length < 20) {
      errors.push('Le message doit contenir au moins 20 caractères');
    }
    if (data.message && data.message.length > 2000) {
      errors.push('Le message ne peut pas dépasser 2000 caractères');
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join(', '));
    }
  }

  /**
   * Simule un délai d'envoi d'email (500ms - 1.5s)
   */
  private async simulateEmailSending(): Promise<void> {
    const delay = Math.random() * 1000 + 500; // Entre 500ms et 1500ms
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Affiche le formulaire de contact
   */
  displayContactForm(user?: any): string {
    const userName = user ? `${user.firstName} ${user.lastName}` : '';
    const userEmail = user?.email || '';
    const userCompany = user?.company || '';
    const userId = user?.id || '';

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contactez-nous - RDS Connect</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #3857e2ff 0%, #285fceff 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 600px;
            width: 100%;
            padding: 40px;
            animation: slideUp 0.5s ease-out;
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
        }

        .logo {
            font-size: 48px;
            margin-bottom: 10px;
        }

        h1 {
            color: #1f2937;
            font-size: 28px;
            margin-bottom: 10px;
        }

        .subtitle {
            color: #6b7280;
            font-size: 16px;
        }

        .user-info {
            background: #f3f4f6;
            padding: 16px;
            border-radius: 10px;
            margin-bottom: 20px;
        }

        .user-info p {
            color: #4b5563;
            font-size: 14px;
            margin-bottom: 4px;
        }

        .user-info strong {
            color: #1f2937;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            color: #374151;
            font-weight: 600;
            margin-bottom: 8px;
            font-size: 14px;
        }

        input, textarea, select {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 10px;
            font-size: 15px;
            transition: all 0.3s ease;
            font-family: inherit;
        }

        input:focus, textarea:focus, select:focus {
            outline: none;
            border-color: #3857e2ff;
            box-shadow: 0 0 0 3px rgba(56, 87, 226, 0.1);
        }

        textarea {
            resize: vertical;
            min-height: 150px;
        }

        .char-count {
            text-align: right;
            color: #9ca3af;
            font-size: 12px;
            margin-top: 4px;
        }

        .submit-btn {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #3857e2ff 0%, #285fceff 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .submit-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(56, 87, 226, 0.3);
        }

        .submit-btn:active {
            transform: translateY(0);
        }

        .submit-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }

        .alert {
            padding: 12px 16px;
            border-radius: 10px;
            margin-bottom: 20px;
            font-size: 14px;
            display: none;
        }

        .alert.show {
            display: block;
            animation: slideDown 0.3s ease-out;
        }

        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .alert-success {
            background-color: #d1fae5;
            color: #065f46;
            border: 1px solid #6ee7b7;
        }

        .alert-error {
            background-color: #fee2e2;
            color: #991b1b;
            border: 1px solid #fca5a5;
        }

        .back-link {
            text-align: center;
            margin-top: 20px;
        }

        .back-link a {
            color: #3857e2ff;
            text-decoration: none;
            font-size: 14px;
            font-weight: 600;
        }

        .back-link a:hover {
            text-decoration: underline;
        }

        @media (max-width: 640px) {
            .container {
                padding: 30px 20px;
            }

            h1 {
                font-size: 24px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">📧</div>
            <h1>Contactez-nous</h1>
            <p class="subtitle">Nous sommes là pour vous aider !</p>
        </div>

        <div id="alert" class="alert"></div>

        ${
          userName
            ? `
        <div class="user-info">
            <p><strong>Connecté en tant que:</strong> ${userName}</p>
            <p><strong>Email:</strong> ${userEmail}</p>
            ${userCompany ? `<p><strong>Entreprise:</strong> ${userCompany}</p>` : ''}
        </div>
        `
            : ''
        }

        <form id="contactForm">
            ${userId ? `<input type="hidden" name="userId" value="${userId}">` : ''}
            ${userCompany ? `<input type="hidden" name="company" value="${userCompany}">` : ''}

            <div class="form-group">
                <label for="name">Nom complet *</label>
                <input 
                    type="text" 
                    id="name" 
                    name="name" 
                    required 
                    placeholder="Jean Dupont"
                    value="${userName}"
                    minlength="2"
                    maxlength="100"
                >
            </div>

            <div class="form-group">
                <label for="email">Email *</label>
                <input 
                    type="email" 
                    id="email" 
                    name="email" 
                    required 
                    placeholder="jean.dupont@exemple.com"
                    value="${userEmail}"
                >
            </div>

            ${
              !userName
                ? `
            <div class="form-group">
                <label for="company">Entreprise (optionnel)</label>
                <input 
                    type="text" 
                    id="company" 
                    name="company" 
                    placeholder="Nom de votre entreprise"
                    maxlength="100"
                >
            </div>
            `
                : ''
            }

            <div class="form-group">
                <label for="subject">Sujet *</label>
                <select id="subject" name="subject" required>
                    <option value="">Sélectionnez un sujet</option>
                    <option value="Question générale">Question générale</option>
                    <option value="Problème technique">Problème technique</option>
                    <option value="Facturation">Facturation</option>
                    <option value="Demande de fonctionnalité">Demande de fonctionnalité</option>
                    <option value="Bug ou erreur">Bug ou erreur</option>
                    <option value="Compte utilisateur">Compte utilisateur</option>
                    <option value="Autre">Autre</option>
                </select>
            </div>

            <div class="form-group">
                <label for="message">Message *</label>
                <textarea 
                    id="message" 
                    name="message" 
                    required 
                    placeholder="Décrivez votre demande en détail..."
                    minlength="20"
                    maxlength="2000"
                ></textarea>
                <div class="char-count">
                    <span id="charCount">0</span> / 2000 caractères
                </div>
            </div>

            <button type="submit" class="submit-btn" id="submitBtn">
                Envoyer le message
            </button>
        </form>

        <div class="back-link">
            <a href="/">← Retour à l'accueil</a>
        </div>
    </div>

    <script>
        const form = document.getElementById('contactForm');
        const messageTextarea = document.getElementById('message');
        const charCount = document.getElementById('charCount');
        const submitBtn = document.getElementById('submitBtn');
        const alert = document.getElementById('alert');

        // Compteur de caractères
        messageTextarea.addEventListener('input', function() {
            const count = this.value.length;
            charCount.textContent = count;
            
            if (count > 2000) {
                charCount.style.color = '#ef4444';
            } else {
                charCount.style.color = '#9ca3af';
            }
        });

        // Gestion du formulaire
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Désactiver le bouton
            submitBtn.disabled = true;
            submitBtn.textContent = 'Envoi en cours...';

            // Récupérer les données du formulaire
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                company: document.getElementById('company')?.value || '',
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value,
                userId: document.querySelector('input[name="userId"]')?.value || ''
            };

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (response.ok) {
                    // Succès
                    showAlert(data.message, 'success');
                    form.reset();
                    charCount.textContent = '0';
                    
                    // Rediriger après 2 secondes
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 2000);
                } else {
                    // Erreur
                    showAlert(data.message || 'Une erreur est survenue', 'error');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Envoyer le message';
                }
            } catch (error) {
                console.error('Erreur:', error);
                showAlert('Erreur de connexion. Veuillez réessayer.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Envoyer le message';
            }
        });

        function showAlert(message, type) {
            alert.textContent = message;
            alert.className = \`alert alert-\${type} show\`;
            
            setTimeout(() => {
                alert.classList.remove('show');
            }, 5000);
        }
    </script>
</body>
</html>
    `;
  }
}
